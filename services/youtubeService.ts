
export interface YouTubeVideo {
    id: string;
    title: string;
    channelTitle: string;
    thumbnail: string;
    link: string;
}

const getApiKey = () => {
    try {
        // @ts-ignore
        return import.meta.env.VITE_YOUTUBE_API_KEY || "";
    } catch (e) {
        return "";
    }
};

export const searchYouTubeVideos = async (query: string): Promise<YouTubeVideo[]> => {
    const apiKey = getApiKey();
    if (!apiKey) {
        console.warn("YouTube API Key missing");
        return [];
    }

    try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            const err = await response.json();
            console.error("YouTube API Error:", err);
            return [];
        }

        const data = await response.json();
        
        return (data.items || []).map((item: any) => ({
            id: item.id.videoId,
            // Basic HTML entity decoding
            title: item.snippet.title.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"),
            channelTitle: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
            link: `https://www.youtube.com/watch?v=${item.id.videoId}`
        }));
    } catch (error) {
        console.error("Error searching YouTube:", error);
        return [];
    }
};
