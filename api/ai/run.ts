import { runAI } from "../../services/aiOrchestrator";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const { taskType, context, payload, preferredModel } = req.body;
    
    const result = await runAI(taskType, context, payload, preferredModel);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Error running AI task:", error);
    res.status(500).json({ error: error.message || "Failed to run AI task" });
  }
}
