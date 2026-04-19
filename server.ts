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

  app.post("/api/spotify/token", async (req, res) => {
    try {
      const clientId = process.env.VITE_SPOTIFY_CLIENT_ID;
      const clientSecret = process.env.VITE_SPOTIFY_CLIENT_SECRET;

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
    app.get('/*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
