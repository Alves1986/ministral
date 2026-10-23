/**
 * push-reminders — Lembretes automáticos via Web Push (cron diário).
 *
 * O que faz:
 * 1. LEMBRETE DO DIA DA ESCALA: para cada membro escalado HOJE, envia push
 *    "Você está escalado hoje" (título do evento + horário).
 * 2. JANELA DE DISPONIBILIDADE: quando a janela ABRE (availability_start = hoje)
 *    avisa os membros; quando FECHA (availability_end < hoje) avisa o encerramento.
 *
 * Deduplicação: tabela push_reminder_log (migration 20260630_push_reminder_log.sql).
 *
 * Agendamento (cron no Supabase): rodar diariamente, ex:
 *   - cron schedule: 0 8 * * *  (todos os dias às 08:00)
 *   - invoke: push-reminders com header `x-cron-secret: <WHATSAPP_CRON_SECRET>`
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeCompare } from "../_shared/safeCompare.ts";
import webpush from "npm:web-push@3.6.7";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function localDate(offsetHours = 0): string {
  const now = new Date();
  const shifted = new Date(now.getTime() + offsetHours * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ── Validação do cron (WHATSAPP_CRON_SECRET — reutiliza o secret dos cron de WhatsApp) ──
  const cronSecret = Deno.env.get("WHATSAPP_CRON_SECRET") || Deno.env.get("PUSH_CRON_SECRET");
  if (!cronSecret) {
    return new Response(JSON.stringify({ error: "Missing cron secret configuration" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
  const headerSecret = req.headers.get("x-cron-secret");
  if (!safeCompare(headerSecret || "", cronSecret)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── VAPID ──
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    let privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!publicKey || !privateKey) {
      return new Response(JSON.stringify({ success: false, error: "VAPID não configurado." }), {
        headers: { "Content-Type": "application/json" }, status: 200,
      });
    }
    privateKey = privateKey.trim().replace(/[\r\n\s]/g, "").replace(/^['"]|['"]$/g, "");
    webpush.setVapidDetails("mailto:admin@ministral.app", publicKey, privateKey);

    const today = localDate(-3); // fuso Brasília aproximado (UTC-3)
    const nowBr = new Date(new Date().getTime() - 3 * 60 * 60 * 1000);
    const currentHour = nowBr.getUTCHours();
    const { data: minHourRows } = await supabase
      .from("organization_ministries")
      .select("id, reminder_hour");
    const reminderHourByMinistry = new Map<string, number>(
      (minHourRows || []).map((m: any) => [m.id, m.reminder_hour ?? 8])
    );

    const summary: Record<string, number> = { scale_day: 0, window_open: 0, window_close: 0 };

    // ── 1. LEMBRETE DO DIA DA ESCALA ──
    const { data: assignments } = await supabase
      .from("schedule_assignments")
      .select("id, organization_id, ministry_id, event_date, role, member_id, event_rules(title, time)")
      .eq("event_date", today)
      .not("member_id", "is", null)
      .neq("role", "__EVENT_EXCLUDED__");

    if (assignments && assignments.length > 0) {
       for (const a of assignments) {
        if (!a.member_id) continue;
        const rh = reminderHourByMinistry.get(a.ministry_id) ?? 8;
        if (rh !== currentHour) continue;
        const rule = Array.isArray(a.event_rules) ? a.event_rules[0] : a.event_rules;
        const title = rule?.title || "Evento";
        const time = rule?.time ? String(rule.time).slice(0, 5) : "";

        // Dedupe
        const { data: existing } = await supabase
          .from("push_reminder_log")
          .select("id")
          .eq("member_id", a.member_id)
          .eq("ministry_id", a.ministry_id)
          .eq("reminder_type", "scale_day")
          .eq("reminder_date", today)
          .maybeSingle();
        if (existing) continue;

        // Busca a inscrição push do membro
        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", a.member_id);

        if (subs && subs.length > 0) {
          const payload = JSON.stringify({
            title: `📅 Você está escalado hoje — ${title}`,
            body: time ? `Hoje às ${time}. Confirme sua presença!` : "Confirme sua presença!",
            icon: "/branding/icon-light.png",
            data: { url: "/?tab=dashboard", type: "scale_day" },
          });
          for (const sub of subs) {
            if (!sub.p256dh || !sub.auth || !sub.endpoint) continue;
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload
              );
              summary.scale_day++;
            } catch (e: any) {
              if (e?.statusCode === 410 || e?.statusCode === 404) {
                await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
              }
            }
          }
        }

        // Loga o envio (mesmo sem inscrição, para não tentar de novo hoje)
        await supabase.from("push_reminder_log").insert({
          member_id: a.member_id,
          ministry_id: a.ministry_id,
          reminder_type: "scale_day",
          reminder_date: today,
        });
      }
    }

    // ── 2. JANELA DE DISPONIBILIDADE (abertura / fechamento) ──
    const { data: ministries } = await supabase
      .from("organization_ministries")
      .select("id, organization_id, availability_start, availability_end, reminder_hour");

    if (ministries && ministries.length > 0) {
      for (const m of ministries) {
        const start = m.availability_start ? String(m.availability_start).slice(0, 10) : null;
        const end = m.availability_end ? String(m.availability_end).slice(0, 10) : null;
        const isLegacyLocked = start?.startsWith("1970");

        // Abertura: janela começa hoje
        if (start && !isLegacyLocked && start === today) {
          const { data: existing } = await supabase
            .from("push_reminder_log")
            .select("id")
            .eq("ministry_id", m.id)
            .eq("reminder_type", "window_open")
            .eq("reminder_date", today)
            .maybeSingle();
          if (!existing) {
            await sendToMinistry(supabase, m.id, {
              title: "📅 Disponibilidade Liberada!",
              body: "O período de disponibilidade abriu. Marque seus dias agora!",
              type: "window_open",
            });
            await supabase.from("push_reminder_log").insert({
              member_id: null,
              ministry_id: m.id,
              reminder_type: "window_open",
              reminder_date: today,
            });
            summary.window_open++;
          }
        }

        // Fechamento: janela encerrada (end < hoje e não é o lock legado)
        if (end && !end.startsWith("1970") && end < today) {
          const { data: existing } = await supabase
            .from("push_reminder_log")
            .select("id")
            .eq("ministry_id", m.id)
            .eq("reminder_type", "window_close")
            .eq("reminder_date", today)
            .maybeSingle();
          if (!existing) {
            await sendToMinistry(supabase, m.id, {
              title: "🔒 Janela Encerrada",
              body: "O período para enviar disponibilidade terminou.",
              type: "window_close",
            });
            await supabase.from("push_reminder_log").insert({
              member_id: null,
              ministry_id: m.id,
              reminder_type: "window_close",
              reminder_date: today,
            });
            summary.window_close++;
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, summary, date: today }), {
      headers: { "Content-Type": "application/json" }, status: 200,
    });
  } catch (err: any) {
    console.error("[push-reminders] Erro:", err?.message || err);
    return new Response(JSON.stringify({ success: false, error: "Erro interno ao processar lembretes." }), {
      headers: { "Content-Type": "application/json" }, status: 500,
    });
  }
});

async function sendToMinistry(
  supabase: any,
  ministryId: string,
  notif: { title: string; body: string; type: string }
) {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .or(`ministry_id.eq.${ministryId},allowed_ministries.cs.{${ministryId}}`);

  const ids = (profiles || []).map((p: any) => p.id);
  if (ids.length === 0) return;

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", ids);

  if (!subs || subs.length === 0) return;

  const payload = JSON.stringify({
    title: notif.title,
    body: notif.body,
    icon: "/branding/icon-light.png",
    data: { url: "/?tab=availability", type: notif.type },
  });

  for (const sub of subs) {
    if (!sub.p256dh || !sub.auth || !sub.endpoint) continue;
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
    } catch (e: any) {
      if (e?.statusCode === 410 || e?.statusCode === 404) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }
  }
}
