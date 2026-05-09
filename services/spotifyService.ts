
interface SpotifyTrack {
    id: string;
    name: string;
    artists: { name: string }[];
    album: { images: { url: string }[] };
    external_urls: { spotify: string };
    uri: string;
}

interface SpotifyPlaylist {
    id: string;
    name: string;
    images: { url: string }[];
    tracks: { total: number };
}

// Cache para tokens de APPLICATIVO
let appToken: string | null = null;
let tokenExpiry: number = 0;

const getCredentials = (customClientId?: string) => {
    let clientId = customClientId || "";
    if (!clientId) {
        try {
            // @ts-ignore
            if (import.meta.env) clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "";
        } catch(e) {}
    }

    return { clientId };
};

export const getClientCredentialsToken = async (customClientId?: string, customClientSecret?: string): Promise<string | null> => {
    // Como a configuração não tem mais backend `/api/`, não é possível mais pegar 
    // um client_credentials secret em segurança no Frontend.
    // Usaremos apenas o fluxo OAuth do Usuário!
    return null;
};

// --- 2. AUTENTICAÇÃO DO USUÁRIO (Implicit Grant) ---
export const getLoginUrl = (customClientId?: string) => {
    const { clientId } = getCredentials(customClientId);
    if (!clientId) return null;

    const redirectUri = window.location.origin; // Redireciona para a própria página
    const scopes = [
        "user-read-private",
        "user-read-email",
        "playlist-read-private",
        "playlist-read-collaborative"
    ].join(" ");

    return `https://accounts.spotify.com/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=token&show_dialog=true`;
};

export const handleLoginCallback = () => {
    const hash = window.location.hash;
    const tokenMatch = hash.match(/access_token=([^&]*)/);
    const expiresInMatch = hash.match(/expires_in=([^&]*)/);

    if (tokenMatch && tokenMatch[1]) {
        const token = tokenMatch[1];
        const expiresIn = expiresInMatch ? expiresInMatch[1] : "3600";
        
        localStorage.setItem('spotify_user_token', token);
        const expiryTime = Date.now() + (Number(expiresIn) || 3600) * 1000;
        localStorage.setItem('spotify_token_expiry', expiryTime.toString());

        // Limpa a URL de forma limpa, sem deixar espaços em branco
        try {
            window.history.replaceState(null, '', window.location.pathname);
        } catch(e) {}
        
        return token;
    }
    return null;
};

export const logoutSpotify = () => {
    localStorage.removeItem('spotify_user_token');
    localStorage.removeItem('spotify_token_expiry');
};

export const isUserLoggedIn = () => {
    const token = localStorage.getItem('spotify_user_token');
    const expiry = localStorage.getItem('spotify_token_expiry');
    if (!token) return false;
    if (expiry && Date.now() > Number(expiry)) {
        logoutSpotify();
        return false;
    }
    return true;
};

const getUserToken = () => {
    if (isUserLoggedIn()) return localStorage.getItem('spotify_user_token');
    return null;
};

// --- 3. FUNÇÕES DE DADOS ---
const fetchSpotify = async (endpoint: string, token: string) => {
    const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
        if (res.status === 401) {
            logoutSpotify();
            throw new Error("Token do Spotify expirado. Por favor, conecte novamente.");
        }
        const err = await res.json();
        throw new Error(err?.error?.message || `Erro ${res.status} no Spotify`);
    }
    return res.json();
};

export const getUserProfile = async () => {
    const token = getUserToken();
    if (!token) return null;
    try {
        return await fetchSpotify('/me', token);
    } catch (e) { return null; }
};

export const getUserPlaylists = async (): Promise<SpotifyPlaylist[]> => {
    const token = getUserToken();
    if (!token) return [];
    try {
        const data = await fetchSpotify('/me/playlists?limit=50', token);
        return data.items || [];
    } catch (e) { return []; }
};

export const getPlaylistTracks = async (playlistId: string): Promise<SpotifyTrack[]> => {
    const token = getUserToken();
    if (!token) return [];
    try {
        const data = await fetchSpotify(`/playlists/${playlistId}/tracks?limit=50`, token);
        return data.items.map((item: any) => item.track).filter((t: any) => t && t.id);
    } catch (e) { return []; }
};

export const searchSpotifyTracks = async (query: string): Promise<SpotifyTrack[]> => {
    let token = getUserToken();

    if (!token) throw new Error("Para buscar músicas no Spotify, faça o login (botão Conectar) com a sua conta.");

    try {
        const data = await fetchSpotify(`/search?q=${encodeURIComponent(query)}&type=track&limit=10`, token);
        return data.tracks?.items || [];
    } catch (e: any) { 
        console.error("Spotify Search Error:", e);
        throw e; 
    }
};
