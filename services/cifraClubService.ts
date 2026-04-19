
import { GoogleGenAI, Type } from "@google/genai";

export interface CifraClubResult {
    title: string;
    artist: string;
    url: string;
    key: string;
}

// FIX: Simplified Gemini initialization to use process.env.API_KEY string directly as per guidelines.
const getAiClient = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Cache simples para evitar chamadas repetitivas
const searchCache: Record<string, CifraClubResult[]> = {};

export const searchCifraClub = async (query: string): Promise<CifraClubResult[]> => {
    const cacheKey = query.toLowerCase().trim();
    if (searchCache[cacheKey]) {
        return searchCache[cacheKey];
    }

    const ai = getAiClient();

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

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            artist: { type: Type.STRING },
                            url: { type: Type.STRING },
                            key: { type: Type.STRING }
                        }
                    }
                }
            }
        });

        if (response.text) {
            const results = JSON.parse(response.text);
            
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