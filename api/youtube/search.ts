function decodeHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractPlaylistId(input: string): string | null {
  if (!input) return null;
  const clean = input.trim();
  const listMatch = clean.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
  if (listMatch && listMatch[1]) return listMatch[1];
  if (/^(PL|UU|LL|FL|RD|OLAK5uy_)[a-zA-Z0-9_-]{10,}$/i.test(clean)) return clean;
  return null;
}

function extractVideoId(input: string): string | null {
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

async function scrapePlaylistDirect(playlistId: string) {
  try {
    const url = `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    if (!res.ok) return [];
    const html = await res.text();
    const match = html.match(/var ytInitialData\s*=\s*({.+?});<\/script>/) || html.match(/ytInitialData\s*=\s*({.+?});/);
    if (!match) return [];
    const data = JSON.parse(match[1]);

    const videos: any[] = [];
    const seenIds = new Set<string>();

    function traverse(obj: any) {
      if (!obj || typeof obj !== 'object') return;

      // Modern YouTube (lockupViewModel)
      if (obj.lockupViewModel && obj.lockupViewModel.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO') {
        const vm = obj.lockupViewModel;
        const id = vm.contentId || vm.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint?.videoId;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          const title = vm.metadata?.lockupMetadataViewModel?.title?.content ||
                        vm.rendererContext?.accessibilityContext?.label?.split(/\s+\d+\s+minutos/)[0] || '';
          const channel = vm.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content || '';
          const thumb = vm.contentImage?.thumbnailViewModel?.image?.sources?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
          const titleLower = title.toLowerCase();
          if (title && !titleLower.includes('vídeo excluído') && !titleLower.includes('vídeo privado') && !titleLower.includes('deleted video') && !titleLower.includes('private video')) {
            videos.push({
              id,
              title: decodeHtml(title),
              channelTitle: channel,
              thumbnail: thumb,
              link: `https://www.youtube.com/watch?v=${id}`
            });
          }
        }
      }

      // Classic YouTube (playlistVideoRenderer)
      if (obj.playlistVideoRenderer) {
        const pvr = obj.playlistVideoRenderer;
        const id = pvr.videoId;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          const title = pvr.title?.runs?.[0]?.text || pvr.title?.simpleText || '';
          const channel = pvr.shortBylineText?.runs?.[0]?.text || '';
          const thumb = pvr.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
          const titleLower = title.toLowerCase();
          if (title && !titleLower.includes('vídeo excluído') && !titleLower.includes('vídeo privado') && !titleLower.includes('deleted video') && !titleLower.includes('private video')) {
            videos.push({
              id,
              title: decodeHtml(title),
              channelTitle: channel,
              thumbnail: thumb,
              link: `https://www.youtube.com/watch?v=${id}`
            });
          }
        }
      }

      for (const k of Object.keys(obj)) {
        if (typeof obj[k] === 'object') traverse(obj[k]);
      }
    }

    traverse(data);
    return videos;
  } catch (err) {
    console.warn('[YouTube API Proxy] Falha ao extrair playlist direta:', err);
    return [];
  }
}

async function scrapeSearchDirect(query: string) {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    if (!res.ok) return [];
    const html = await res.text();
    const match = html.match(/var ytInitialData\s*=\s*({.+?});<\/script>/) || html.match(/ytInitialData\s*=\s*({.+?});/);
    if (!match) return [];
    const data = JSON.parse(match[1]);

    const videos: any[] = [];
    const seenIds = new Set<string>();

    function traverse(obj: any) {
      if (!obj || typeof obj !== 'object') return;
      if (obj.videoRenderer) {
        const vr = obj.videoRenderer;
        const id = vr.videoId;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          const title = vr.title?.runs?.[0]?.text || vr.title?.simpleText || '';
          const channel = vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || '';
          const thumb = vr.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
          if (title) {
            videos.push({
              id,
              title: decodeHtml(title),
              channelTitle: channel,
              thumbnail: thumb,
              link: `https://www.youtube.com/watch?v=${id}`
            });
          }
        }
      }
      for (const k of Object.keys(obj)) {
        if (typeof obj[k] === 'object') traverse(obj[k]);
      }
    }

    traverse(data);
    return videos;
  } catch (err) {
    console.warn('[YouTube API Proxy] Falha ao pesquisar direto:', err);
    return [];
  }
}

async function fetchVideoOEmbed(videoId: string) {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      id: videoId,
      title: decodeHtml(data.title || ''),
      channelTitle: data.author_name || '',
      thumbnail: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      link: `https://www.youtube.com/watch?v=${videoId}`
    };
  } catch (e) {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  try {
    const { query } = req.body || {};
    const cleanQuery = (query || '').trim();

    if (!cleanQuery) {
      return res.status(200).json([]);
    }

    const apiKey = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY || '';
    const playlistId = extractPlaylistId(cleanQuery);
    const videoId = extractVideoId(cleanQuery);

    // 1. PLAYLIST RECOGNITION & EXTRACTION
    if (playlistId) {
      if (apiKey) {
        try {
          const apiUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${encodeURIComponent(playlistId)}&key=${apiKey}`;
          const response = await fetch(apiUrl);
          if (response.ok) {
            const data = await response.json();
            const items = (data.items || [])
              .map((item: any) => {
                const vid = item.snippet?.resourceId?.videoId;
                const title = item.snippet?.title || '';
                const titleLower = title.toLowerCase();
                if (!vid || titleLower.includes('private video') || titleLower.includes('deleted video')) return null;
                return {
                  id: vid,
                  title: decodeHtml(title),
                  channelTitle: item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle || '',
                  thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
                  link: `https://www.youtube.com/watch?v=${vid}`
                };
              })
              .filter(Boolean);

            if (items.length > 0) {
              return res.status(200).json(items);
            }
          }
        } catch (apiErr) {
          console.warn('[YouTube API Proxy] Erro na API do YouTube para Playlist, usando fallback direto:', apiErr);
        }
      }

      // Fallback sem API key / Quota
      const scraped = await scrapePlaylistDirect(playlistId);
      return res.status(200).json(scraped);
    }

    // 2. SINGLE VIDEO RECOGNITION
    if (videoId) {
      const oembed = await fetchVideoOEmbed(videoId);
      if (oembed) {
        return res.status(200).json([oembed]);
      }

      if (apiKey) {
        try {
          const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(videoId)}&key=${apiKey}`;
          const response = await fetch(apiUrl);
          if (response.ok) {
            const data = await response.json();
            if (data.items && data.items.length > 0) {
              const item = data.items[0];
              return res.status(200).json([{
                id: videoId,
                title: decodeHtml(item.snippet?.title || ''),
                channelTitle: item.snippet?.channelTitle || '',
                thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                link: `https://www.youtube.com/watch?v=${videoId}`
              }]);
            }
          }
        } catch (apiErr) {
          console.warn('[YouTube API Proxy] Erro na API para Vídeo único:', apiErr);
        }
      }
    }

    // 3. GENERAL TEXT SEARCH
    if (apiKey) {
      try {
        const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(cleanQuery)}&type=video&key=${apiKey}`;
        const response = await fetch(apiUrl);
        if (response.ok) {
          const data = await response.json();
          const results = (data.items || []).map((item: any) => ({
            id: item.id?.videoId,
            title: decodeHtml(item.snippet?.title || ''),
            channelTitle: item.snippet?.channelTitle || '',
            thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
            link: `https://www.youtube.com/watch?v=${item.id?.videoId}`
          })).filter((v: any) => v.id);

          if (results.length > 0) {
            return res.status(200).json(results);
          }
        }
      } catch (apiErr) {
        console.warn('[YouTube API Proxy] Erro na busca por API, usando fallback:', apiErr);
      }
    }

    // Fallback de busca direto
    const searchResults = await scrapeSearchDirect(cleanQuery);
    return res.status(200).json(searchResults);

  } catch (error: any) {
    console.error("Erro no proxy do YouTube:", error);
    return res.status(500).json({ error: 'Falha ao buscar no YouTube' });
  }
}
