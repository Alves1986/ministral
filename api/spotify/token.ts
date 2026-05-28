export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const clientId = req.body.clientId || process.env.VITE_SPOTIFY_CLIENT_ID;
    const clientSecret = req.body.clientSecret || process.env.VITE_SPOTIFY_CLIENT_SECRET || process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: "Spotify credentials not configured on server" });
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
      },
      body: 'grant_type=client_credentials'
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error: any) {
    console.error("Error fetching Spotify token:", error);
    res.status(500).json({ error: "Failed to fetch Spotify token" });
  }
}
