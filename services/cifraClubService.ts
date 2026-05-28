
export interface CifraClubResult {
    title: string;
    artist: string;
    url: string;
    key: string;
}

// Cache simples para evitar chamadas repetitivas
const searchCache: Record<string, CifraClubResult[]> = {};

export const searchCifraClub = async (query: string): Promise<CifraClubResult[]> => {
    const cacheKey = query.toLowerCase().trim();
    if (searchCache[cacheKey]) {
        return searchCache[cacheKey];
    }

    if (typeof window !== 'undefined') {
        try {
            const res = await fetch('/api/cifraclub/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            if (!res.ok) throw new Error('Cifra Club Proxy API Error');
            const data = await res.json();
            searchCache[cacheKey] = data;
            return data;
        } catch (e) {
            console.error("Error calling Cifra Club API proxy", e);
            return [];
        }
    }

    const { GoogleGenAI, Type } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '' });
    
    try {
        const prompt = `
            Atue como um motor de busca especializado no site Cifra Club (cifraclub.com.br).
            Para o termo de busca: "${query}", retorne os 5 melhores resultados de músicas.
            
            Retorne APENAS um JSON array sem formatação adicional, markdown ou texto explicativo.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING, description: "Nome da música" },
                            artist: { type: Type.STRING, description: "Nome do artista/banda" },
                            url: { type: Type.STRING, description: "URL completa do Cifra Club" },
                            key: { type: Type.STRING, description: "O tom provável da música (ex: G, Cm) ou N/A" }
                        },
                        required: ["title", "artist", "url", "key"]
                    }
                }
            }
        });

        const content = response.text || '';

        if (content) {
            const results = JSON.parse(content);
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
