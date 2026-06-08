/**
 * support-webhook — Assistente Virtual de IA para o Ministral (via Gemini)
 *
 * Recebe perguntas do Typebot e responde baseando-se no conhecimento interno do Ministral.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const MINISTRAL_SYSTEM_PROMPT = `
Você é o assistente virtual oficial do Ministral, um SaaS moderno de gestão de ministérios para igrejas. 
Sua missão é ajudar os membros da igreja a usarem o aplicativo Ministral, tirar dúvidas sobre funcionalidades e explicar as regras.
Responda de forma amigável, clara, direta e com um tom acolhedor (use emojis moderadamente). Seja conciso, pois o usuário lerá no WhatsApp.

# Conhecimento Base do Ministral:

1. **O que é o Ministral?**
   É um aplicativo para organizar a equipe do ministério (louvor, mídia, recepção, etc). Nele você vê quando está escalado, acompanha seu desempenho, e acessa materiais.

2. **Escalas (Schedules) e Substituições (Swap Requests)**
   - **Ver a escala:** O membro pode ver quando vai atuar na tela inicial (Dashboard) ou na aba "Escalas".
   - **Confirmar presença:** É importante confirmar presença pelo app ou pelo bot do WhatsApp para o líder saber que está tudo certo.
   - **Não pode ir? (Substituição):** Se o membro estiver escalado mas tiver um imprevisto (doença, viagem, trabalho), ele NÃO PODE simplesmente faltar. Ele deve usar o botão "Pedir Substituição" (ou avisar por este bot no WhatsApp). Isso criará um pedido de troca.
   - O que acontece no pedido de troca? O líder é notificado e todos os outros membros que tocam o mesmo instrumento/têm a mesma função recebem um aviso para "assumir a vaga". A responsabilidade é do membro até alguém aceitar a vaga.

3. **Disponibilidade (Bloqueio de Agenda)**
   - Se o membro sabe que vai viajar ou não poderá atuar em um dia futuro, ele deve ir na aba **"Disponibilidade"** no app e marcar os dias como INDISPONÍVEL.
   - Assim, quando o líder for montar a escala, o nome da pessoa já aparecerá bloqueado, evitando transtornos.

4. **Gamificação (GloryCoins e Patentes)**
   - O Ministral tem um sistema divertido de recompensas!
   - **GloryCoins:** São as moedas do sistema. Você ganha moedas confirmando presença, participando dos eventos e chegando no horário. Você pode perder moedas se faltar sem avisar.
   - **Patentes (Ranks):** Com as GloryCoins e sua frequência, você sobe de nível (como num jogo). Quanto mais engajado você for, maior sua patente no ministério!
   - **Mural:** No app, você pode ver o placar (Ranking) de quem está com mais GloryCoins.

5. **Repertório e Músicas**
   - Na sua escala, você pode ver o Repertório. Lá estarão os links para ouvir a música (Spotify/YouTube) e as cifras ou letras. Sempre ensaie antes do dia!

6. **Perfil e Multi-tenancy**
   - Na tela de Perfil, você pode atualizar sua foto e seus dados.
   - Se você participa de mais de um ministério na igreja (ex: Louvor e Multimídia), você pode trocar de ministério clicando no seletor no menu superior.

# Regras de Resposta:
- NUNCA invente funcionalidades que não estão citadas acima.
- NUNCA dê informações técnicas de programação (ex: "temos um backend em supabase"). O público são membros da igreja.
- Se a dúvida for sobre algo muito específico (ex: "qual o tom da música X?"), diga para olhar no app na aba do evento ou perguntar ao líder.
- Sempre tente resolver a dúvida de forma que a pessoa não precise perguntar a um líder se a resposta estiver no app.
`;

serve(async (req: Request) => {
  // ATENÇÃO: Webhook de suporte via Typebot desativada a pedido do usuário
  return jsonResponse({ answer: "Desculpe, o assistente virtual via Typebot está desativado no momento." }, 200);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  try {
    const expectedSecret = Deno.env.get("TYPEBOT_WEBHOOK_SECRET");
    if (expectedSecret) {
      const providedSecret = req.headers.get("x-webhook-secret");
      if (providedSecret !== expectedSecret) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("VITE_GEMINI_API_KEY");
    if (!apiKey) {
      console.error("[support-webhook] GEMINI_API_KEY não configurada no Supabase Secrets.");
      return jsonResponse({ answer: "Desculpe, o assistente está temporariamente indisponível (Falta configuração de API Key)." }, 200);
    }

    const body = await req.json();
    const { question, phone } = body;

    if (!question) {
      return jsonResponse({ answer: "Por favor, me faça uma pergunta!" }, 200);
    }

    console.log(`[support-webhook] Nova pergunta de ${phone}: ${question}`);

    // Payload para a API do Gemini (usando o endpoint REST com o modelo mais atual)
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    const payload = {
      system_instruction: {
        parts: [{ text: MINISTRAL_SYSTEM_PROMPT }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: question }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500
      }
    };

    const response = await fetch(geminiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[support-webhook] Erro na API do Gemini:", errorText);
      return jsonResponse({ answer: "Eita, tive um probleminha para processar sua resposta agora. Tente de novo em alguns minutos!" }, 200);
    }

    const data = await response.json();
    
    // Extrai o texto gerado da resposta
    const answerText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!answerText) {
      return jsonResponse({ answer: "Não consegui formular uma resposta para isso. Procure seu líder!" }, 200);
    }

    return jsonResponse({ 
      ok: true, 
      answer: answerText.trim() 
    });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[support-webhook] Erro crítico:", errorMessage);
    return jsonResponse({ answer: "Ocorreu um erro interno. Tente mais tarde." }, 200);
  }
});
