
export interface CifraClubResult {
    title: string;
    artist: string;
    url: string;
    key: string;
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getApiKey(): string {
    if (typeof window !== 'undefined') {
        return (import.meta as any).env?.VITE_OPENROUTER_API_KEY || '';
    }
    if (typeof process !== 'undefined' && process.env) {
        return process.env.VITE_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || '';
    }
    return '';
}

// Cache simples para evitar chamadas repetitivas
const searchCache: Record<string, CifraClubResult[]> = {};

export const searchCifraClub = async (query: string): Promise<CifraClubResult[]> => {
    const cacheKey = query.toLowerCase().trim();
    if (searchCache[cacheKey]) {
        return searchCache[cacheKey];
    }

    const apiKey = getApiKey();
    if (!apiKey) {
        console.error("VITE_OPENROUTER_API_KEY is not defined");
        return [];
    }

    try {
        const prompt = `
            Atue como um motor de busca especializado no site Cifra Club (cifraclub.com.br).
            Para o termo de busca: "${query}", retorne os 5 melhores resultados de músicas.
            
            Retorne APENAS um JSON array. Não use markdown.
            Estrutura do objeto:
            - title: Nome da música
            - artist: Nome do artista/banda
            - url: URL completa do Cifra Club (ex: https://www.cifraclub.com.br/artista/musica/)
            - key: O tom provável da música (ex: G, Cm, A#) ou "N/A" se não souber.
        `;

        const body = {
            model: 'google/gemini-2.5-flash', // Using Gemini 2.5 Flash on OpenRouter, or any other appropriate model
            messages: [
                { role: 'user', content: prompt }
            ]
        };

        const res = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://ministral.app',
                'X-Title': 'Ministral',
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error?.message || `OpenRouter error ${res.status}`);
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';

        if (content) {
            // Clean markdown blocks if present
            const cleaned = content.trim();
            const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
            const jsonStr = jsonMatch ? jsonMatch[1].trim() : cleaned;

            const results = JSON.parse(jsonStr);
            
            // Garbage Collection simples do Cache
            // Se o cache ficar muito grande, deleta a entrada mais antiga (FIFO aproximado)
            const keys = Object.keys(searchCache);
            if (keys.length > 20) {
                delete searchCache[keys[0]];
            }
            
            searchCache[cacheKey] = results; 
            return results;
        }
        return [];
    } catch (error) {
        console.error("Error searching Cifra Club:", error);
        return [];
    }
};