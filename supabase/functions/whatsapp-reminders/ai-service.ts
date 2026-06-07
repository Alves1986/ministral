export async function generateOrientationsWithAI(
    ministryName: string,
    ministryType: string,
    openRouterApiKey: string
  ): Promise<string> {
    const models = ["deepseek/deepseek-r1", "google/gemini-2.0-flash-thinking-exp:free"];
  
    const prompt = `Você é um assistente de gestão para ministérios evangélicos.
Gere no máximo 4 orientações curtas (em bullet points usando números ou emojis adequados) para a equipe do ministério "${ministryName}" (Tipo: ${ministryType}).
Use um tom encorajador, cristão e focado no preparo espiritual e técnico para o culto. Não crie saudações ou rodapés, nem a palavra "Orientações", apenas os bullet points diretamente. Exemplo:
1. ...
2. ...`;
  
    for (const model of models) {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openRouterApiKey}`,
            "HTTP-Referer": "https://ministral.app",
            "X-Title": "Ministral",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: "user", content: prompt }]
          }),
          signal: controller.signal
        });
        clearTimeout(id);
        
        if (response.ok) {
          const data = await response.json();
          let text = data.choices[0]?.message?.content?.trim() || "";
          
          text = text.replace(/<think>[\s\S]*?<\/think>\s*/gi, "").trim();
          
          if (text) return text;
        } else {
             const errorText = await response.text();
             console.warn(`[AI] Error response from ${model}:`, errorText);
        }
      } catch (err) {
        console.warn(`[whatsapp-reminders] AI (model: ${model}) limit/error:`, err);
      }
    }
    
    return `1. Cheguem com 30 minutos de antecedência.\n2. Comuniquem a liderança sobre qualquer imprevisto.`;
  }
