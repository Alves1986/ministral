export interface YouTubeVideo {
    id: string;
    title: string;
    channelTitle: string;
    thumbnail: string;
    link: string;
}

const getApiKey = () => {
    try {
        return (typeof process !== 'undefined' && (process.env?.VITE_YOUTUBE_API_KEY || process.env?.YOUTUBE_API_KEY)) || "";
    } catch (e) {
        return "";
    }
};

function decodeHtml(html: string): string {
    if (!html) return '';
    return html
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

export function extractPlaylistId(input: string): string | null {
    if (!input) return null;
    const clean = input.trim();
    const listMatch = clean.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
    if (listMatch && listMatch[1]) return listMatch[1];
    if (/^(PL|UU|LL|FL|RD|OLAK5uy_)[a-zA-Z0-9_-]{10,}$/i.test(clean)) return clean;
    return null;
}

export function extractVideoId(input: string): string | null {
    if (!input) return null;
    const clean = input.trim();
    const youtuBeMatch = clean.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
    if (youtuBeMatch && youtuBeMatch[1]) return youtuBeMatch[1];
    const watchMatch = clean.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
    if (watchMatch && watchMatch[1]) return watchMatch[1];
    const pathMatch = clean.match(/youtube\.com\/(?:embed|v|shorts)\/([a-zA-Z0-9_-]{11})/i);
    if (pathMatch && pathMatch[1]) return pathMatch[1];
    return null;
}

export const searchYouTubeVideos = async (query: string, customApiKey?: string): Promise<YouTubeVideo[]> => {
    const cleanQuery = (query || '').trim();
    if (!cleanQuery) return [];

    // 1. Tenta via proxy do backend (/api/youtube/search)
    if (typeof window !== 'undefined') {
        try {
            const res = await fetch('/api/youtube/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: cleanQuery, customApiKey })
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    return data;
                }
            }
        } catch (error: any) {
            console.warn("[YouTube Service] Proxy /api/youtube/search indisponível ou em dev mode, tentando fallback:", error);
        }
    }

    // 2. Fallbacks diretos no cliente
    const playlistId = extractPlaylistId(cleanQuery);
    const videoId = extractVideoId(cleanQuery);
    const apiKey = customApiKey || getApiKey();

    // 2.1 Vídeo único via oEmbed (suporta CORS no navegador)
    if (videoId) {
        try {
            const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`;
            const oembedRes = await fetch(oembedUrl);
            if (oembedRes.ok) {
                const data = await oembedRes.json();
                return [{
                    id: videoId,
                    title: decodeHtml(data.title || ''),
                    channelTitle: data.author_name || '',
                    thumbnail: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                    link: `https://www.youtube.com/watch?v=${videoId}`
                }];
            }
        } catch (e) {
            console.warn("[YouTube Service] Falha no oEmbed:", e);
        }
    }

    // 2.2 Se tiver API key disponível no cliente
    if (apiKey) {
        try {
            if (playlistId) {
                const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${encodeURIComponent(playlistId)}&key=${apiKey}`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    return (data.items || []).map((item: any) => {
                        const vid = item.snippet?.resourceId?.videoId;
                        if (!vid) return null;
                        return {
                            id: vid,
                            title: decodeHtml(item.snippet?.title || ''),
                            channelTitle: item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle || '',
                            thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
                            link: `https://www.youtube.com/watch?v=${vid}`
                        };
                    }).filter(Boolean);
                }
            } else if (videoId) {
                const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(videoId)}&key=${apiKey}`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    if (data.items?.[0]) {
                        const item = data.items[0];
                        return [{
                            id: videoId,
                            title: decodeHtml(item.snippet?.title || ''),
                            channelTitle: item.snippet?.channelTitle || '',
                            thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                            link: `https://www.youtube.com/watch?v=${videoId}`
                        }];
                    }
                }
            } else {
                const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${encodeURIComponent(cleanQuery)}&type=video&key=${apiKey}`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    return (data.items || []).map((item: any) => ({
                        id: item.id?.videoId,
                        title: decodeHtml(item.snippet?.title || ''),
                        channelTitle: item.snippet?.channelTitle || '',
                        thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
                        link: `https://www.youtube.com/watch?v=${item.id?.videoId}`
                    })).filter((v: any) => v.id);
                }
            }
        } catch (e) {
            console.error("[YouTube Service] Erro ao consultar API do YouTube diretamente:", e);
        }
    }

    return [];
};
