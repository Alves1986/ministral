import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { query } = req.body;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({ error: 'Query string is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    const prompt = `Retorne os 5 melhores resultados encontrados no site cifraclub.com.br para a busca: "${query}". Para cada resultado, retorne o nome da música (title), nome do artista ou banda (artist), URL completa da música no cifraclub (url) e o tom (key) se conseguir extrair (ou "N/A").`;
    
    let resultContent: string | null = null;
    let lastError: any = null;

    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
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
                },
                required: ["title", "artist", "url", "key"]
              }
            }
          }
        });
        
        resultContent = response.text || "[]";
        break; // Sucesso, sai do loop
      } catch (err: any) {
        console.warn(`[CifraClub] Modelo ${model} falhou: ${err.message}`);
        lastError = err;
      }
    }

    if (!resultContent) {
      throw lastError || new Error('Todos os modelos falharam');
    }

    const results = JSON.parse(resultContent);
    res.status(200).json(results);
  } catch (error: any) {
    console.error("Error searching Cifra Club via Gemini:", error);
    res.status(500).json({ error: error.message || 'Error occurred while searching Cifra Club' });
  }
}
