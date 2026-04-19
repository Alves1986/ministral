import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export enum AI_TASKS {
  MINISTRY_HEALTH = 'MINISTRY_HEALTH',
  SCALE_ANALYSIS = 'SCALE_ANALYSIS',
  GENERATE_NOTICE = 'GENERATE_NOTICE',
  EXPLAIN_DECISION = 'EXPLAIN_DECISION',
  TEXT_REWRITE = 'TEXT_REWRITE',
  SCALE_SUGGESTION = 'SCALE_SUGGESTION',
  MEMBER_ANALYSIS = 'MEMBER_ANALYSIS',
  PREVENTIVE_ALERT = 'PREVENTIVE_ALERT',
  SCALE_GENERATION = 'SCALE_GENERATION'
}

const GLOBAL_PERSONALITY = `
Você é um especialista em gestão de ministérios e organização de equipes.
Seu foco é: organização, equilíbrio, clareza e decisões práticas.
Evite respostas genéricas. Sempre entregue sugestões aplicáveis.
Seja direto e estruturado.
`;

interface AIContext {
  organization_name: string;
  ministry_name: string;
  total_members: number;
  active_members: number;
  roles: string[];
  history?: unknown;
  current_event?: unknown;
}

const PROMPTS: Record<AI_TASKS, (data: any) => string> = {
  [AI_TASKS.MINISTRY_HEALTH]: (data) => `
    Analise a saúde do ministério com base nos dados fornecidos.
    DADOS: ${JSON.stringify(data)}

    REGRAS DE RESPOSTA:
    Retorne OBRIGATORIAMENTE um JSON puro seguindo a estrutura solicitada.
    ESTRUTURA:
    {
      "score": número de 0 a 100,
      "status": "otimo" | "bom" | "atencao" | "critico",
      "summary": "frase curta e direta descrevendo o estado geral",
      "alerts": ["lista de problemas detectados"],
      "suggestions": ["lista de sugestões práticas de melhoria"]
    }
  `,
  [AI_TASKS.SCALE_ANALYSIS]: (data) => `
    Analise a organização das escalas.
    Verifique: sobrecarga, repetição, falta de membros e equilíbrio geral.
    DADOS: ${JSON.stringify(data)}

    Retorne análise clara + melhorias.
    
    PADRÃO DE RESPOSTA:
    - Título
    - Pontos principais
    - Sugestões práticas (Markdown)
  `,
  [AI_TASKS.GENERATE_NOTICE]: (data) => `
    Crie um aviso unificado e organizado para o grupo do WhatsApp do ministério.
    
    DIRETRIZES:
    1. Trate todo evento como "Culto" no título da mensagem (ex: "Escala para o Culto - ${data.evento}").
    2. Liste os membros e suas funções de forma clara e visualmente agradável com emojis.
    3. Inclua OBRIGATORIAMENTE ao final da mensagem o seguinte bloco de orientações:

    ⚠️ *Orientações:* 
    1. Cheguem com 30 minutos de antecedência para check-list dos equipamentos.
    2. Caso haja algum imprevisto, comuniquem a liderança imediatamente.
    3. Não esqueça de Confirmar a escala realizando o check-in no aplicativo.

    Vamos juntos servir com excelência! 🚀

    INFORMAÇÕES:
    Evento: ${data.evento}
    Data: ${data.data}
    Horário: ${data.horario}
    Membros e Funções: ${data.funcoes}

    REGRAS DE RESPOSTA:
    Retorne APENAS um objeto JSON.
    ESTRUTURA:
    { "message": "Texto completo da mensagem formatado para WhatsApp (com quebras de linha e emojis)" }
  `,
  [AI_TASKS.EXPLAIN_DECISION]: (data) => `
    Explique de forma clara como a escala foi gerada.
    Inclua critérios, equilíbrio e limitações.
    DADOS: ${JSON.stringify(data)}

    PADRÃO DE RESPOSTA (Markdown):
    - Título
    - Critérios usados
    - Sugestões práticas
  `,
  [AI_TASKS.TEXT_REWRITE]: (data) => {
    const styles: Record<string, string> = {
      professional: "Reescreva o texto abaixo de forma formal, profissional e respeitosa.",
      exciting: "Reescreva o texto abaixo de forma animada, motivadora e envolvente.",
      urgent: "Reescreva o texto abaixo de forma urgente, direta e com senso de prioridade."
    };
    return `
      ${styles[data.tone as string] || styles.professional}
      TEXTO: "${data.text}"
      REGRAS: Retorne APENAS o texto reescrito, sem explicações.
    `;
  },
  [AI_TASKS.SCALE_SUGGESTION]: (data) => `
    Analise os dados e sugira melhorias antes da geração da escala.
    DADOS: ${JSON.stringify(data)}

    PADRÃO DE RESPOSTA (Markdown):
    - Título
    - Pontos principais
    - Sugestões práticas
  `,
  [AI_TASKS.MEMBER_ANALYSIS]: (data) => `
    Analise os membros e identifique: mais ativos, sobrecarregados e ausentes.
    DADOS: ${JSON.stringify(data)}

    PADRÃO DE RESPOSTA (Markdown):
    - Título
    - Pontos principais
    - Sugestões práticas
  `,
  [AI_TASKS.PREVENTIVE_ALERT]: (data) => `
    Detecte problemas como: falta de membros, conflitos de função e sobrecarga.
    DADOS: ${JSON.stringify(data)}

    PADRÃO DE RESPOSTA (Markdown):
    - Título
    - Pontos principais
    - Sugestões práticas
  `,
  [AI_TASKS.SCALE_GENERATION]: (data) => `
    Gere uma escala de ministério equilibrada e otimizada para as ocorrências abaixo seguindo RIGOROSAMENTE as regras de negócio.
    
    CRITÉRIOS DE DISPONIBILIDADE E PREENCHIMENTO:
    1. EXCLUSIVIDADE DE DISPONIBILIDADE: Um membro SÓ pode ser escalado se ele tiver marcado disponibilidade EXPLICITAMENTE no objeto 'availability' para aquela data (YYYY-MM-DD). Se não houver registro para ele naquela data (id dele não consta como chave), ou se o valor para a data for 'unavailable', ele NÃO PODE SER ESCALADO em hipótese alguma.
    2. DEIXAR VAZIO SE NECESSÁRIO: Se para uma determinada função em uma data não houver NENHUM membro disponível que possua aquela função em seu perfil (functions), você DEVE deixar essa vaga vazia. Não tente "inventar" uma escala ou colocar alguém indisponível. É preferível uma escala incompleta do que uma que viole as disponibilidades.
    3. RESPEITO ÀS FUNÇÕES: Um membro só pode ser escalado em uma função (role) que esteja listada em seu array 'functions'.
    
    REGRAS DE CONFLITO (RULES):
    Use os dados de 'rules' para evitar conflitos:
    - blockGroups: Listas de funções que NÃO podem ser feitas pela mesma pessoa no mesmo evento.
    - memberBlocks: Pares de IDs de membros que NÃO podem ser escalados juntos no mesmo evento.
    - memberPrefers: Pares de IDs de membros que devem ser escalados juntos sempre que possível.
    
    DADOS DE ENTRADA:
    - Ocorrências: ${JSON.stringify(data.occurrences)}
    - Funções Requeridas: ${JSON.stringify(data.roles)}
    - Membros: ${JSON.stringify(data.members)}
    - Disponibilidade: ${JSON.stringify(data.availability)}
    - Escala Atual (NÃO SOBREPOR): ${JSON.stringify(data.existingAssignments)}
    - Regras de Conflito: ${JSON.stringify(data.rules)}
    
    REGRAS DE RESPOSTA:
    Retorne APENAS um array JSON. Não inclua texto explicativo.
    ESTRUTURA DOS ITENS:
    { "event_rule_id": "ruleId da ocorrência", "event_date": "YYYY-MM-DD da ocorrência", "role": "função escalada", "member_id": "id do membro" }
  `
};

export async function runAI(taskType: AI_TASKS, context: AIContext | any, payload?: any): Promise<any> {
    let actualContext = context as AIContext;
    let actualPayload = payload;

    if (!payload && context && !actualContext.organization_name) {
        actualPayload = context;
        actualContext = {
            organization_name: "Geral",
            ministry_name: "Geral",
            total_members: 0,
            active_members: 0,
            roles: []
        };
    }

    if (!actualPayload) throw new Error("Payload is required for AI task");

    const fullPrompt = `
    ${GLOBAL_PERSONALITY}
    
    CONTEXTO DA ORGANIZAÇÃO:
    - Organização: ${actualContext.organization_name}
    - Ministério: ${actualContext.ministry_name}
    - Total de Membros: ${actualContext.total_members}
    - Membros Ativos: ${actualContext.active_members}
    - Funções: ${(actualContext.roles || []).join(', ')}
    
    TAREFA:
    ${PROMPTS[taskType](actualPayload)}
  `;

    try {
        const needsJson = [
            AI_TASKS.MINISTRY_HEALTH,
            AI_TASKS.GENERATE_NOTICE,
            AI_TASKS.SCALE_GENERATION
        ].includes(taskType);

        const config: any = {
            systemInstruction: "Você é um assistente especialista em gestão eclesiástica. Responda de forma direta e técnica.",
        };

        if (needsJson) {
            config.responseMimeType = "application/json";
            // Adicionar schema específico para escala para garantir perfeição
            if (taskType === AI_TASKS.SCALE_GENERATION) {
                config.responseSchema = {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            event_rule_id: { type: Type.STRING },
                            event_date: { type: Type.STRING },
                            role: { type: Type.STRING },
                            member_id: { type: Type.STRING }
                        },
                        required: ["event_rule_id", "event_date", "role", "member_id"]
                    }
                };
            }
        }

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
            config
        });

        const content = response.text || "";
        return parseAIResponse(content, taskType);
    } catch (error) {
        console.error(`[AIOrchestrator] Gemini failed for task ${taskType}:`, error);
        throw new Error(`AI processing failed for ${taskType}.`);
    }
}

function parseAIResponse(content: string, taskType: AI_TASKS): any {
    try {
        const cleaned = content.trim();
        
        // Tenta extrair JSON de blocos de código se Gemini envolver em markdown
        const jsonMatch = cleaned.match(/```json\n([\s\S]*?)\n```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : cleaned;
        
        if (jsonStr.startsWith('{') || jsonStr.startsWith('[')) {
            const parsed = JSON.parse(jsonStr);
            
            // Especial para SCALE_GENERATION: garantir que é um array
            if (taskType === AI_TASKS.SCALE_GENERATION) {
                if (Array.isArray(parsed)) return parsed;
                if (parsed.assignments && Array.isArray(parsed.assignments)) return parsed.assignments;
                if (parsed.escala && Array.isArray(parsed.escala)) return parsed.escala;
            }

            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                if (taskType === AI_TASKS.GENERATE_NOTICE) {
                    if (parsed.message) return [{ name: "Grupo do Ministério", role: "Aviso Geral", message: parsed.message }];
                }
                if ('messages' in parsed) return parsed.messages;
            }
            return parsed;
        }
        
        return cleaned;
    } catch (error) {
        console.warn("[AIOrchestrator] Failed to parse JSON response:", error);
        return content;
    }
}

export async function generateScheduleWithAI(data: any): Promise<any[]> {
    const context: AIContext = {
        organization_name: "Geral",
        ministry_name: "Geral",
        total_members: data.members?.length || 0,
        active_members: data.members?.length || 0,
        roles: data.roles || []
    };

    const result = await runAI(AI_TASKS.SCALE_GENERATION, context, data);
    return Array.isArray(result) ? result : [];
}
