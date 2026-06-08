
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
    
    // Fallback/Upgrade to Vagalume API (Client Side) as requested from gpedro/vagalume-api
    try {
        const url = new URL('https://api.vagalume.com.br/search.excerpt');
        url.searchParams.append('q', query);
        url.searchParams.append('limit', '8');
        
        const res = await fetch(url.toString(), {
            // Optional headers
            headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) throw new Error('Vagalume API Error');
        
        const data = await res.json();
        
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
    try {
        const url = new URL('https://api.vagalume.com.br/search.php');
        url.searchParams.append('art', artist);
        url.searchParams.append('mus', song);
        // Optional API KEY, Vagalume allows basic without it but rate limited.
        url.searchParams.append('apikey', '660a4395f992ff67786584e238f501aa'); 

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error('Vagalume Lyrics API Error');

        const data = await res.json();
        
        if (data && (data.type === 'exact' || data.type === 'aprox') && data.mus && data.mus.length > 0) {
            return data.mus[0].text || "";
        }
        
        return "";
    } catch (e) {
        console.error("Vagalume Lyrics Fetch Error:", e);
        return "";
    }
};
