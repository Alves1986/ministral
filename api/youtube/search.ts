export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  try {
    const { query, customApiKey } = req.body;
    const apiKey = customApiKey || process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'YouTube API Key not configured' });
    }

    const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Error occurred while fetching from YouTube');
    }

    const data = await response.json();
    
    const results = (data.items || []).map((item: any) => {
      let title = item.snippet?.title || '';
      // Decode HTML entities
      title = title.replace(/&quot;/g, '"')
                   .replace(/&#39;/g, "'")
                   .replace(/&amp;/g, '&')
                   .replace(/&lt;/g, '<')
                   .replace(/&gt;/g, '>');

      return {
        id: item.id?.videoId,
        title,
        channelTitle: item.snippet?.channelTitle || '',
        thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
        link: `https://www.youtube.com/watch?v=${item.id?.videoId}`
      };
    });

    res.status(200).json(results);
  } catch (error: any) {
    console.error("Error searching YouTube:", error);
    res.status(500).json({ error: error.message || 'Failed to search YouTube videos' });
  }
}
