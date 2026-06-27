
import Vagalume from 'vagalume';

export interface CifraClubResult {
    title: string;
    artist: string;
    url: string;
    key: string;
}

// Cache simples para evitar chamadas repetitivas
const searchCache: Record<string, CifraClubResult[]> = {};

// Instancia da API (sem apikey, conforme docs do repo)
const vagalumeApi = new Vagalume();

export const searchCifraClub = async (query: string): Promise<CifraClubResult[]> => {
    if (typeof window !== 'undefined') {
        try {
            const res = await fetch('/api/cifraclub/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Erro na API do Vagalume Proxy');
            }
            return await res.json();
        } catch (error: any) {
            console.error("Error calling Vagalume API proxy", error);
            return [];
        }
    }

    const cacheKey = query.toLowerCase().trim();
    if (searchCache[cacheKey]) {
        return searchCache[cacheKey];
    }
    
    try {
        const data = await vagalumeApi.search('artmus', query, 10);
        
        if (data && data.response && data.response.docs) {
            const results: CifraClubResult[] = data.response.docs.map((doc: any) => ({
                title: doc.title || "Unknown",
                artist: doc.band || doc.artist || "Unknown",
                url: doc.url ? `https://www.vagalume.com.br${doc.url}` : `https://www.vagalume.com.br/`,
                key: "-"
            }));
            
            searchCache[cacheKey] = results;
            return results;
        }
        return [];
    } catch (e) {
        console.error("Vagalume Search Error:", e);
        return [];
    }
};

export const getVagalumeLyrics = async (artist: string, song: string): Promise<string> => {
    if (typeof window !== 'undefined') {
        try {
            const res = await fetch('/api/cifraclub/lyrics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ artist, song })
            });
            if (!res.ok) {
                return "";
            }
            const data = await res.json();
            return data.lyrics || "";
        } catch (error: any) {
            console.error("Error calling Vagalume Lyrics proxy", error);
            return "";
        }
    }

    try {
        const data = await vagalumeApi.lyrics({ art: artist, mus: song });
        
        if (data && (data.type === 'exact' || data.type === 'aprox') && data.mus && data.mus.length > 0) {
            return data.mus[0].text || "";
        }
        
        return "";
    } catch (e) {
        console.error("Vagalume Lyrics Fetch Error:", e);
        return "";
    }
};
