import { runAI, AI_TASKS } from './aiOrchestrator';
 
export const polishAnnouncementAI = async (
 text: string,
 tone: 'professional' | 'exciting' | 'urgent',
 _model?: string
): Promise<string> => {
  try {
    const result = await runAI(AI_TASKS.TEXT_REWRITE, { text, tone });
    return result?.html || result?.text || result || text;
  } catch (error) {
    console.error('[aiService] Error polishing announcement:', error);
    return text;
  }
};
