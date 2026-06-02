import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { generateScheduleWithAI } from "./services/aiOrchestrator.ts";
import { generateAISchedule } from "./services/aiScheduleService.ts";
import { polishAnnouncementAI } from "./services/aiService.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/ai/schedule", async (req, res) => {
    try {
      const { occurrences, roles, members, availability, existingAssignments, rules, model } = req.body;
      
      // If a specific model is requested, use the orchestrator
      if (model) {
        const result = await generateScheduleWithAI({ occurrences, roles, members, availability, existingAssignments, rules, model });
        return res.json(result);
      }

      // Otherwise use the standard AI schedule service (Gemini first)
      const result = await generateAISchedule({ occurrences, roles, members, availability, existingAssignments });
      res.json(result);
    } catch (error: any) {
      console.error("Error generating schedule:", error);
      res.status(500).json({ error: error.message || "Failed to generate schedule" });
    }
  });

  app.get("/api/weather", async (req, res) => {
    try {
      const { lat, lon } = req.query;
      if (!lat || !lon) {
        return res.status(400).json({ error: "Missing lat/lon" });
      }

      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
      if (!weatherRes.ok) {
        throw new Error("Weather API Error");
      }
      const weatherJson = await weatherRes.json();

      let city = "Localização";
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const cityRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&accept-language=pt-BR`,
          { 
              signal: controller.signal,
              headers: { 'User-Agent': 'GestaoEscala/1.0' }
          }
        );
        clearTimeout(timeoutId);

        if (cityRes.ok) {
          const cityJson = await cityRes.json();
          const addr = cityJson.address;
          const suburb = addr?.suburb || addr?.neighbourhood || addr?.city_district || addr?.quarter;
          const cityName = addr?.city || addr?.town || addr?.municipality || addr?.village;
          
          if (suburb && cityName) {
            city = `${suburb}, ${cityName}`;
          } else {
            city = cityName || suburb || addr?.county || addr?.state || "Local";
          }
          city = city
            .replace("Município de ", "")
            .replace("Distrito de ", "")
            .replace("Região Administrativa de ", "")
            .trim();
        }
      } catch (e) {
        console.warn("Falha ao buscar cidade:", e);
      }

      res.json({
        temperature: weatherJson.current_weather.temperature,
        weatherCode: weatherJson.current_weather.weathercode,
        city
      });
    } catch (error: any) {
      console.error("Error fetching weather:", error);
      res.status(500).json({ error: "Failed to fetch weather" });
    }
  });

  app.post("/api/ai/polish", async (req, res) => {
    try {
      const { text, tone, model } = req.body;
      const result = await polishAnnouncementAI(text, tone, model);
      res.json({ text: result });
    } catch (error: any) {
      console.error("Error polishing text:", error);
      res.status(500).json({ error: error.message || "Failed to polish text" });
    }
  });

  app.post("/api/ai/run", async (req, res) => {
    try {
      const { runAI } = await import("./services/aiOrchestrator.ts");
      const { taskType, context, payload, preferredModel } = req.body;
      const result = await runAI(taskType, context, payload, preferredModel);
      res.json(result);
    } catch (error: any) {
      console.error("Error in /api/ai/run:", error);
      res.status(500).json({ error: error.message || "Failed to run AI task" });
    }
  });

  app.post("/api/cifraclub/search", async (req, res) => {
    try {
      const { searchCifraClub } = await import("./services/cifraClubService.ts");
      const { query } = req.body;
      const result = await searchCifraClub(query);
      res.json(result);
    } catch (error: any) {
      console.error("Error in /api/cifraclub/search:", error);
      res.status(500).json({ error: error.message || "Failed to search Cifra Club" });
    }
  });

  app.post("/api/youtube/search", async (req, res) => {
    try {
      const { searchYouTubeVideos } = await import("./services/youtubeService.ts");
      const { query } = req.body;
      const result = await searchYouTubeVideos(query);
      res.json(result);
    } catch (error: any) {
      console.error("Error in /api/youtube/search:", error);
      res.status(500).json({ error: error.message || "Failed to search YouTube" });
    }
  });

  app.get("/api/spotify/config", (req, res) => {
    res.json({
      clientId: process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID || ""
    });
  });

  app.post("/api/spotify/token", async (req, res) => {
    try {
      const clientId = req.body.clientId || process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID;
      const clientSecret = req.body.clientSecret || process.env.SPOTIFY_CLIENT_SECRET || process.env.VITE_SPOTIFY_CLIENT_SECRET;

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
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching Spotify token:", error);
      res.status(500).json({ error: "Failed to fetch Spotify token" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
