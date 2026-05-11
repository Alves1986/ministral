import { generateScheduleWithAI } from './aiOrchestrator';
 
interface ScheduleInput {
 occurrences: { date: string; time: string; ruleId: string; title: string }[];
 roles: string[];
 members: { id: string; name: string; functions: string[] }[];
 availability: Record<string, Record<string, string>>;
 existingAssignments: { event_rule_id: string; event_date: string;
                        role: string; member_id: string }[];
 rules?: any;
}
 
export const generateAISchedule = async (input: ScheduleInput, model?: string) => {
  try {
    const result: any = await generateScheduleWithAI(input, model);
    return Array.isArray(result) ? result : (result.assignments || []);
  } catch (error) {
    console.error('[aiScheduleService] Error generating schedule:', error);
    return [];
  }
};
