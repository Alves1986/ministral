import { getSupabase } from '../../services/supabase/client';
import { EventRule } from '../../domain/events/types';

export async function fetchEventRules(
  ministryId: string,
  orgId: string
): Promise<EventRule[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase client not initialized');

  try {
    const { data, error } = await supabase
      .from('event_rules')
      .select('*')
      .eq('organization_id', orgId)
      .eq('ministry_id', ministryId) // RESTAURADO PARA RLS e CONSISTÊNCIA
      .eq('active', true);

    if (error) {
      console.warn('Warning fetching event rules:', error.message || error);
      return [];
    }

    return (data || []) as EventRule[];
  } catch (e) {
    console.warn('Exception fetching event rules:', e);
    return [];
  }
}