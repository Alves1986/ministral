import { generateScheduleWithAI } from "../../services/aiOrchestrator.ts";
import { generateAISchedule } from "../../services/aiScheduleService.ts";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const { occurrences, roles, members, availability, existingAssignments, rules, model } = req.body;
    
    if (model) {
      const result = await generateScheduleWithAI({ occurrences, roles, members, availability, existingAssignments, rules }, model);
      return res.status(200).json(result);
    }

    const result = await generateAISchedule({ occurrences, roles, members, availability, existingAssignments });
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Error generating schedule:", error);
    res.status(500).json({ error: error.message || "Failed to generate schedule" });
  }
}
