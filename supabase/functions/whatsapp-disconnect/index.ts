import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl        = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Variáveis do Supabase não configuradas.");
    }

    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionApiUrl || !evolutionApiKey) {
      throw new Error("Credenciais da Evolution API não configuradas.");
    }

    const { instance_name, ministry_id } = await req.json();

    if (!instance_name || !ministry_id) {
      throw new Error("instance_name e ministry_id são obrigatórios");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── SEGURANÇA: Verificar se o ministério pertence à organização e validar o JWT (SEC-02) ──
    // Tenta organization_ministries primeiro (padrão atual)
    let { data: ministry, error: minErr } = await supabase
      .from("organization_ministries")
      .select("organization_id")
      .eq("id", ministry_id)
      .maybeSingle();

    // Fallback para tabela ministries se necessário
    if (!ministry) {
      const { data: fallbackMin } = await supabase
        .from("ministries")
        .select("organization_id")
        .eq("id", ministry_id)
        .maybeSingle();
      ministry = fallbackMin;
    }

    if (!ministry) {
      throw new Error("Ministério não encontrado.");
    }

    const targetOrgId = ministry.organization_id;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header ausente.");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      throw new Error("Usuário não autenticado: " + (userErr?.message || "Não encontrado"));
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("is_admin, is_super_admin, organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      throw new Error("Perfil do usuário não encontrado.");
    }

    const isAuthorized =
      profile.is_super_admin ||
      (profile.is_admin && profile.organization_id === targetOrgId);

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas administradores podem desconectar WhatsApp." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Executa a deleção física na Evolution API após aprovação de segurança ──
    const cleanApiUrl = evolutionApiUrl.trim().replace(/\/+$/, "");
    const cleanInstance = instance_name ? instance_name.trim().replace(/^\/+|\/+$/g, "") : "";
    if (!cleanInstance) throw new Error("Instância inválida.");
    const endpoint = `${cleanApiUrl}/instance/delete/${cleanInstance}`;
    const deleteResponse = await fetch(endpoint, {
      method: "DELETE",
      headers: {
        "apikey": evolutionApiKey,
      },
    });

    // Considera 404 como aceitável (instância já não existe na Evolution API)
    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      const body = await deleteResponse.text().catch(() => "");
      throw new Error(`Evolution API retornou erro ao deletar (${deleteResponse.status}): ${body}`);
    }

    // Atualiza estado no banco
    await supabase.from("ministry_whatsapp").update({
      connected:    false,
      phone_number: null,
      updated_at:   new Date().toISOString(),
    }).eq("ministry_id", ministry_id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[whatsapp-disconnect] Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
