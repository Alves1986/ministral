
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

// Token de APP (Client Credentials)
let appToken: string | null = null;
let tokenExpiry: number = 0;

const getClientId = (customClientId?: string) => {
    if (customClientId) return customClientId;
    try {
        // @ts-ignore
        if (typeof import.meta.env !== 'undefined') return import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
    } catch (e) {}
    return '';
};

export const getClientCredentialsToken = async (customClientId?: string, customClientSecret?: string): Promise<string | null> => {
    // Cache só quando NÃO estamos sobrescrevendo credenciais
    if (!customClientId && !customClientSecret && appToken && Date.now() < tokenExpiry) return appToken;

    try {
        const clientId = customClientId || getClientId(undefined);
        const clientSecret = customClientSecret || '';

        const response = await fetch('/api/spotify/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId, clientSecret }),
        });

        const data = await response.json();
        if (data.access_token) {
            appToken = data.access_token;
            tokenExpiry = Date.now() + (Number(data.expires_in) || 3600) * 1000 - 60000;
            return appToken;
        }
        if (data.error) throw new Error(data.error);
    } catch (e: any) {
        console.error('Erro auth app spotify via server:', e);
        throw e;
    }
    return null;
};

export const getLoginUrl = async (customClientId?: string): Promise<string | null> => {
    let clientId = customClientId || '';
    if (!clientId) {
        try {
            // @ts-ignore
            if (typeof import.meta.env !== 'undefined') clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
        } catch (e) {}
    }

    if (!clientId) {
        try {
            const response = await fetch('/api/spotify/config');
            if (response.ok) {
                const data = await response.json();
                clientId = data.clientId || '';
            }
        } catch (e) {
            console.error('Erro ao carregar clientId do Spotify do servidor:', e);
        }
    }

    if (!clientId) return null;

    const redirectUri = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const scopes = [
        'user-read-private',
        'user-read-email',
        'playlist-read-private',
        'playlist-read-collaborative',
    ].join(' ');

    return `https://accounts.spotify.com/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=token&show_dialog=true`;
};

export const handleLoginCallback = (): string | null => {
    if (typeof window === 'undefined') return null;

    const hash = window.location.hash;
    const tokenMatch = hash.match(/access_token=([^&]*)/);
    const expiresInMatch = hash.match(/expires_in=([^&]*)/);

    if (tokenMatch && tokenMatch[1]) {
        const token = tokenMatch[1];
        const expiresIn = expiresInMatch ? expiresInMatch[1] : '3600';

        localStorage.setItem('spotify_user_token', token);
        const expiryTime = Date.now() + (Number(expiresIn) || 3600) * 1000;
        localStorage.setItem('spotify_token_expiry', expiryTime.toString());

        try {
            window.history.replaceState(null, '', window.location.pathname);
        } catch (e) {}

        return token;
    }
    return null;
};

export const logoutSpotify = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('spotify_user_token');
    localStorage.removeItem('spotify_token_expiry');
};

export const isUserLoggedIn = (): boolean => {
    if (typeof window === 'undefined') return false;
    const token = localStorage.getItem('spotify_user_token');
    if (!token) return false;
    const expiry = localStorage.getItem('spotify_token_expiry');
    if (!expiry) return true;
    if (Date.now() > Number(expiry)) {
        logoutSpotify();
        return false;
    }
    return true;
};

const getStoredUserToken = (): string | null => {
    if (!isUserLoggedIn()) return null;
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('spotify_user_token') || null;
};

const fetchSpotify = async (endpoint: string, token: string): Promise<any> => {
    const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
    });

    if (!res.ok) {
        if (res.status === 401) {
            logoutSpotify();
            throw new Error('Token do Spotify expirado. Por favor, conecte novamente.');
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Erro ${res.status} no Spotify`);
    }

    return res.json();
};

export const getUserProfile = async (): Promise<any | null> => {
    const token = getStoredUserToken();
    if (!token) return null;
    try {
        return await fetchSpotify('/me', token);
    } catch (e) {
        return null;
    }
};

export const getUserPlaylists = async (): Promise<SpotifyPlaylist[]> => {
    const token = getStoredUserToken();
    if (!token) return [];
    try {
        const data = await fetchSpotify('/me/playlists?limit=50', token);
        return data.items || [];
    } catch (e) {
        return [];
    }
};

export const getPlaylistTracks = async (playlistId: string): Promise<SpotifyTrack[]> => {
    const token = getStoredUserToken();
    if (!token) return [];
    try {
        const data = await fetchSpotify(`/playlists/${playlistId}/tracks?limit=50`, token);
        return (data.items || [])
            .map((item: any) => item.track)
            .filter((t: any) => t && t.id);
    } catch (e) {
        return [];
    }
};

export const searchSpotifyTracks = async (
    query: string,
    customClientId?: string,
    customClientSecret?: string,
): Promise<SpotifyTrack[]> => {
    if (!query?.trim()) return [];

    // 1) Tenta token do usuário primeiro
    let token = getStoredUserToken();

    // 2) Se não houver, cai para Client Credentials pelo backend
    if (!token) {
        token = await getClientCredentialsToken(customClientId, customClientSecret);
    }

    if (!token) {
        throw new Error('Para buscar músicas no Spotify, faça o login (botão Conectar) com a sua conta.');
    }

    const endpoint = `/search?q=${encodeURIComponent(query)}&type=track&limit=10`;
    const data = await fetchSpotify(endpoint, token);
    return data.tracks?.items || [];
};
