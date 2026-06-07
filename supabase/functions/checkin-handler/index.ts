import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// --- HMAC SIGNING UTILS ---
const encoder = new TextEncoder();

async function getCryptoKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("CHECKIN_SECRET_KEY") || "ministral_super_secret_checkin_key_2026";
  const keyBuf = encoder.encode(secret);
  return await crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function verifySignature(payloadStr: string, signatureHex: string): Promise<boolean> {
  const cryptoKey = await getCryptoKey();
  const signatureBytes = new Uint8Array(
    signatureHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
  );
  return await crypto.subtle.verify(
    "HMAC",
    cryptoKey,
    signatureBytes,
    encoder.encode(payloadStr)
  );
}

// --- PREMIUM HTML TEMPLATE ---
function getHtmlResponse(success: boolean, title: string, message: string, timeDetails?: string): string {
  const themeNavy = "#0f1f3d";
  const themeGold = "#c9a84c";
  
  const icon = success 
    ? `<div class="icon-circle success">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
       </div>`
    : `<div class="icon-circle error">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
       </div>`;

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Check-in — Ministral</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=Plus+Jakarta+Sans:wght@400;500;700&display=swap" rel="stylesheet">
      <style>
        :root {
          --navy: ${themeNavy};
          --gold: ${themeGold};
          --slate-50: #f8fafc;
          --slate-100: #f1f5f9;
          --slate-800: #1e293b;
          --slate-900: #0f172a;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'Plus Jakarta Sans', sans-serif;
          background: linear-gradient(135deg, var(--navy) 0%, #1e1e2d 100%);
          color: white;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          overflow-x: hidden;
        }
        .container {
          width: 100%;
          max-width: 440px;
          perspective: 1000px;
        }
        .card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 40px 30px;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          transform: translateY(20px);
          opacity: 0;
          animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes slideUp {
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .logo-container {
          margin-bottom: 25px;
        }
        .logo-text {
          font-family: 'Outfit', sans-serif;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.5px;
          background: linear-gradient(to right, white 60%, var(--gold) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .icon-wrapper {
          margin-bottom: 25px;
          display: flex;
          justify-content: center;
        }
        .icon-circle {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        }
        .icon-circle.success {
          background: rgba(16, 185, 129, 0.15);
          border: 2px solid rgb(16, 185, 129);
          color: rgb(16, 185, 129);
          animation: pulseSuccess 2s infinite;
        }
        .icon-circle.error {
          background: rgba(239, 68, 68, 0.15);
          border: 2px solid rgb(239, 68, 68);
          color: rgb(239, 68, 68);
          animation: shake 0.5s ease-in-out;
        }
        @keyframes pulseSuccess {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        h1 {
          font-family: 'Outfit', sans-serif;
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 12px;
          color: white;
        }
        p.message {
          font-size: 15px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 25px;
          padding: 0 10px;
        }
        .time-box {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 12px;
          font-size: 13px;
          font-weight: 500;
          color: var(--gold);
          margin-bottom: 30px;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          background: linear-gradient(135deg, var(--gold) 0%, #b2933d 100%);
          color: var(--navy);
          text-decoration: none;
          font-weight: 700;
          font-size: 15px;
          padding: 16px;
          border-radius: 14px;
          box-shadow: 0 8px 20px rgba(201, 168, 76, 0.25);
          transition: all 0.3s ease;
          border: none;
          cursor: pointer;
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 25px rgba(201, 168, 76, 0.4);
        }
        .btn:active {
          transform: translateY(1px);
        }
        .footer {
          margin-top: 25px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.3);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="logo-container">
            <span class="logo-text">Ministral</span>
          </div>
          <div class="icon-wrapper">
            ${icon}
          </div>
          <h1>${title}</h1>
          <p class="message">${message}</p>
          ${timeDetails ? `<div class="time-box">${timeDetails}</div>` : ""}
          <button class="btn" onclick="window.close()">Fechar Janela</button>
          <div class="footer">
            &copy; 2026 Ministral. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Permite receber dados tanto por query string (GET) quanto por corpo (POST)
  let token = "";
  const url = new URL(req.url);
  
  if (req.method === "GET") {
    token = url.searchParams.get("token") || "";
  } else if (req.method === "POST") {
    try {
      const body = await req.json();
      token = body.token || "";
    } catch (_) {}
  }

  const isHtmlExpected = req.method === "GET" && !req.headers.get("accept")?.includes("application/json");

  try {
    if (!token) {
      throw new Error("Token de check-in ausente ou inválido.");
    }

    const parts = token.split(".");
    if (parts.length !== 2) {
      throw new Error("Formato do token de check-in inválido.");
    }

    const [payloadBase64, signatureHex] = parts;

    // Verificar assinatura
    const isValid = await verifySignature(payloadBase64, signatureHex);
    if (!isValid) {
      throw new Error("Token de check-in adulterado ou com assinatura inválida.");
    }

    // Decodificar payload
    const decodedStr = atob(payloadBase64);
    const payload = JSON.parse(decodedStr);
    
    const { memberId, eventRuleId, date, orgId, ministryId } = payload;
    if (!memberId || !eventRuleId || !date || !orgId || !ministryId) {
      throw new Error("Conteúdo do token incompleto.");
    }

    // Inicializar Supabase Admin Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar a regra do evento
    const { data: rule, error: ruleError } = await supabase
      .from("event_rules")
      .select("time, title")
      .eq("id", eventRuleId)
      .single();

    if (ruleError || !rule) {
      throw new Error("Escala ou regra de evento não encontrada.");
    }

    // --- VALIDAÇÃO DA JANELA DE TEMPO (GMT-3 / Brasília) ---
    // Criamos as datas com o timezone offset correto de Brasília (-03:00)
    const eventTimeStr = `${date}T${rule.time.substring(0, 5)}:00-03:00`;
    const eventDate = new Date(eventTimeStr);
    
    if (isNaN(eventDate.getTime())) {
      throw new Error("Horário do evento inválido.");
    }

    const eventTimeMs = eventDate.getTime();
    const nowMs = Date.now();

    const windowStartMs = eventTimeMs - 30 * 60 * 1000; // 30 minutos antes
    const windowEndMs = eventTimeMs + 90 * 60 * 1000;   // 1h 30min depois

    // Formatar horário local do evento para exibição
    const [year, month, day] = date.split("-");
    const formattedDate = `${day}/${month}/${year}`;
    const timeDetails = `Evento: ${rule.title}\nData: ${formattedDate} às ${rule.time.substring(0, 5)}`;

    if (nowMs < windowStartMs) {
      const minutesRemaining = Math.ceil((windowStartMs - nowMs) / 60000);
      const hours = Math.floor(minutesRemaining / 60);
      const mins = minutesRemaining % 60;
      const waitStr = hours > 0 ? `${hours}h e ${mins}min` : `${mins}min`;
      
      const errMsg = `O check-in para este evento ainda não está aberto. A abertura ocorre 30 minutos antes do início (restam ${waitStr}).`;
      
      if (isHtmlExpected) {
        return new Response(getHtmlResponse(false, "Check-in Fechado", errMsg, timeDetails), {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      } else {
        return new Response(JSON.stringify({ ok: false, error: errMsg, code: "TOO_EARLY" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    if (nowMs > windowEndMs) {
      const errMsg = "O período de check-in para este evento já foi encerrado. A janela fecha 1h 30min após o início.";
      
      if (isHtmlExpected) {
        return new Response(getHtmlResponse(false, "Janela Expirada", errMsg, timeDetails), {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      } else {
        return new Response(JSON.stringify({ ok: false, error: errMsg, code: "EXPIRED" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // --- EFETUAR CHECK-IN ---
    const { error: insertError } = await supabase
      .from("event_checkins")
      .insert({
        member_id: memberId,
        event_rule_id: eventRuleId,
        date: date,
        organization_id: orgId,
        ministry_id: ministryId
      });

    if (insertError) {
      // Código de erro PG para Unique Constraint Violation: 23505
      if (insertError.code === "23505") {
        const msg = "Você já realizou o check-in para este culto anteriormente!";
        if (isHtmlExpected) {
          return new Response(getHtmlResponse(true, "Check-in Confirmado", msg, timeDetails), {
            headers: { "Content-Type": "text/html; charset=utf-8" }
          });
        } else {
          return new Response(JSON.stringify({ ok: true, message: msg, alreadyDone: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }
      throw insertError;
    }

    const successMsg = "Seu check-in foi registrado com sucesso! Obrigado pela pontualidade e dedicação ao ministério.";
    if (isHtmlExpected) {
      return new Response(getHtmlResponse(true, "Check-in Realizado!", successMsg, timeDetails), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    } else {
      return new Response(JSON.stringify({ ok: true, message: "Check-in registrado com sucesso!" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

  } catch (err: any) {
    console.error("[checkin-handler] Erro:", err);
    const errMsg = err.message || "Erro interno ao processar o check-in.";

    if (isHtmlExpected) {
      return new Response(getHtmlResponse(false, "Falha no Check-in", errMsg), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    } else {
      return new Response(JSON.stringify({ ok: false, error: errMsg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
});
