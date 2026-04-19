
export type EventRuleType = 'weekly' | 'single';

export interface EventRule {
  id: string;
  ministry_id: string;
  organization_id: string;
  title: string;
  type: EventRuleType;
  weekday?: number; // 0=Dom, 1=Seg, ..., 6=Sab (Obrigatório se type='weekly')
  date?: string;    // YYYY-MM-DD (Obrigatório se type='single')
  time: string;     // HH:mm (Horário Local)
  duration_minutes: number;
  active: boolean;
}

export interface CalendarEvent {
  id: string;        // ID Determinístico: ruleId_YYYY-MM-DD
  ruleId: string;
  title: string;
  date: string;      // YYYY-MM-DD
  time: string;      // HH:mm
  iso: string;       // YYYY-MM-DDTHH:mm (Local, sem Z)
  weekday: number;
}