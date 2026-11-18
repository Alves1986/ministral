import { polishAnnouncementAI } from "../../services/aiService.js";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const { text, tone, model } = req.body;
    const result = await polishAnnouncementAI(text, tone, model);
    res.status(200).json({ text: result });
  } catch (error: any) {
    console.error("Error polishing text:", error);
    res.status(500).json({ error: "Failed to polish text" });
  }
}
