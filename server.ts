import express from "express";
import { createServer as createViteServer, loadEnv } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { generateScheduleWithAI } from "./services/aiOrchestrator.ts";
import { generateAISchedule } from "./services/aiScheduleService.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente do .env para o Node (process.env)
Object.assign(process.env, loadEnv(process.env.NODE_ENV || "development", process.cwd(), ""));

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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
        const result = await generateScheduleWithAI({ occurrences, roles, members, availability, existingAssignments, rules }, model);
        return res.json(result);
      }

      // Otherwise use the standard AI schedule service (Gemini first)
      const result = await generateAISchedule({ occurrences, roles, members, availability, existingAssignments });
      res.json(result);
    } catch (error: any) {
      console.error("Error generating schedule:", error);
      res.status(500).json({ error: "Failed to generate schedule" });
    }
  });

  app.get("/api/weather", async (req, res) => {
    try {
      const { lat, lon } = req.query;
      if (!lat || !lon) {
        return res.status(400).json({ error: "Missing lat/lon" });
      }

      // Sanitizar lat/lon: apenas números, ponto e sinal negativo
      const safeLat = String(lat).replace(/[^0-9.\-]/g, '');
      const safeLon = String(lon).replace(/[^0-9.\-]/g, '');
      if (!safeLat || !safeLon || isNaN(Number(safeLat)) || isNaN(Number(safeLon))) {
        return res.status(400).json({ error: "Invalid lat/lon" });
      }

      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${safeLat}&longitude=${safeLon}&current_weather=true`);
      if (!weatherRes.ok) {
        throw new Error("Weather API Error");
      }
      const weatherJson = await weatherRes.json();

      let city = "Localização";
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const cityRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${safeLat}&lon=${safeLon}&zoom=14&accept-language=pt-BR`,
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
          
          if (cityName) {
            city = cityName;
          } else {
            city = suburb || addr?.county || addr?.state || "Local";
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
