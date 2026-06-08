
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

// --- 1. AUTENTICAÇÃO DO APLICATIVO (Client Credentials) ---
export const getClientCredentialsToken = async (customClientId?: string, customClientSecret?: string): Promise<string | null> => {
    // Se passarmos custom, não podemos usar cache do token global do app
    if (!customClientId && appToken && Date.now() < tokenExpiry) return appToken;

    try {
        const response = await fetch('/api/spotify/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                clientId: customClientId, 
                clientSecret: customClientSecret 
            })
        });

        const data = await response.json();
        if (data.access_token) {
            appToken = data.access_token;
            tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; 
            return appToken;
        }
        if (data.error) {
            throw new Error(data.error);
        }
    } catch (e: any) {
        console.error("Erro auth app spotify via server:", e);
        throw e;
    }
    return null;
};

// --- 2. AUTENTICAÇÃO DO USUÁRIO (PKCE) ---

const generateRandomString = (length: number) => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

const sha256 = async (plain: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
};

const base64urlencode = (a: ArrayBuffer) => {
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(a))))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const getLoginUrl = async (customClientId?: string): Promise<string | null> => {
    let clientId = customClientId || "";
    if (!clientId) {
        try {
            // @ts-ignore
            if (import.meta.env) clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "";
        } catch(e) {}
    }

    if (!clientId) {
        try {
            const response = await fetch('/api/spotify/config');
            if (response.ok) {
                const data = await response.json();
                clientId = data.clientId || "";
            }
        } catch (e) {
            console.error("Erro ao carregar o ID do cliente Spotify do servidor:", e);
        }
    }

    if (!clientId) return null;

    const redirectUri = window.location.origin; // Redireciona para a própria página
    
    // PKCE
    const codeVerifier = generateRandomString(64);
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64urlencode(hashed);
    
    window.localStorage.setItem('spotify_code_verifier', codeVerifier);

    const scopes = [
        "user-read-private",
        "user-read-email",
        "playlist-read-private",
        "playlist-read-collaborative"
    ].join(" ");

    return `https://accounts.spotify.com/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&code_challenge_method=S256&code_challenge=${codeChallenge}`;
};

export const handleLoginCallback = async (customClientId?: string) => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
        console.error("Spotify Auth Error:", error);
        return null;
    }

    if (code) {
        const codeVerifier = localStorage.getItem('spotify_code_verifier');
        if (!codeVerifier) return null;

        let clientId = customClientId || "";
        if (!clientId) {
            try {
                // @ts-ignore
                if (import.meta.env) clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "";
            } catch(e) {}
        }
        if (!clientId) {
            try {
                const response = await fetch('/api/spotify/config');
                if (response.ok) {
                    const data = await response.json();
                    clientId = data.clientId || "";
                }
            } catch (e) {}
        }

        const redirectUri = window.location.origin;

        try {
            const body = await fetch("https://accounts.spotify.com/api/token", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: clientId,
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: redirectUri,
                    code_verifier: codeVerifier,
                }),
            });

            const response = await body.json();

            if (response.access_token) {
                localStorage.setItem('spotify_user_token', response.access_token);
                if (response.refresh_token) {
                    localStorage.setItem('spotify_refresh_token', response.refresh_token);
                }
                const expiryTime = Date.now() + (response.expires_in * 1000);
                localStorage.setItem('spotify_token_expiry', expiryTime.toString());

                // Limpa storage auxiliar
                localStorage.removeItem('spotify_code_verifier');

                // Limpa param da url
                urlParams.delete('code');
                const newRelativePathQuery = window.location.pathname + (urlParams.toString() ? ('?' + urlParams.toString()) : '');
                window.history.replaceState(null, '', newRelativePathQuery);

                return response.access_token;
            }
        } catch(e) {
            console.error("Error exchanging code for token", e);
        }
    }
    
    // Tratamento legado pra token na hash (fallback)
    const hash = window.location.hash;
    const tokenMatch = hash.match(/access_token=([^&]*)/);
    const expiresInMatch = hash.match(/expires_in=([^&]*)/);

    if (tokenMatch && tokenMatch[1]) {
        const token = tokenMatch[1];
        const expiresIn = expiresInMatch ? expiresInMatch[1] : "3600";
        
        localStorage.setItem('spotify_user_token', token);
        const expiryTime = Date.now() + (Number(expiresIn) || 3600) * 1000;
        localStorage.setItem('spotify_token_expiry', expiryTime.toString());

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

export const searchSpotifyTracks = async (query: string, customClientId?: string, customClientSecret?: string): Promise<SpotifyTrack[]> => {
    let token = getUserToken();
    if (!token) token = await getClientCredentialsToken(customClientId, customClientSecret);

    if (!token) throw new Error("Para buscar músicas no Spotify, faça o login (botão Conectar) com a sua conta.");

    try {
        const data = await fetchSpotify(`/search?q=${encodeURIComponent(query)}&type=track&limit=10`, token);
        return data.tracks?.items || [];
    } catch (e: any) { 
        console.error("Spotify Search Error:", e);
        throw e; 
    }
};
