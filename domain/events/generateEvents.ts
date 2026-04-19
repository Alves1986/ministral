import { EventRule, CalendarEvent } from './types';

export function generateEvents(
  rules: EventRule[],
  startStr: string, // YYYY-MM-DD
  endStr: string    // YYYY-MM-DD
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  
  if (!rules || !Array.isArray(rules)) return [];

  // Parse dates to Local Time (12:00 PM to avoid DST/Timezone edge cases)
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  
  const current = new Date(sy, sm - 1, sd, 12, 0, 0);
  const end = new Date(ey, em - 1, ed, 12, 0, 0);

  // Safety limit to prevent infinite loops (approx 13 months)
  let daysProcessed = 0;
  const MAX_DAYS = 400;

  while (current <= end && daysProcessed < MAX_DAYS) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    const weekday = current.getDay(); // 0 (Sun) - 6 (Sat) Local Time

    // Filter and map rules
    for (const rule of rules) {
        if (!rule.active) continue;

        let isMatch = false;

        if (rule.type === 'weekly') {
            // Strict comparison with Number coercion to handle DB returns
            if (rule.weekday !== undefined && rule.weekday !== null) {
                isMatch = Number(rule.weekday) === weekday;
            }
        } else if (rule.type === 'single') {
            isMatch = rule.date === dateString;
        }

        if (isMatch) {
            events.push({
                id: `${rule.id}|${dateString}`, // Deterministic ID for React Keys
                ruleId: rule.id,
                title: rule.title,
                date: dateString,
                time: rule.time,
                iso: `${dateString}T${rule.time}`,
                weekday: weekday
            });
        }
    }

    // Advance 1 day safely
    current.setDate(current.getDate() + 1);
    daysProcessed++;
  }

  // Always return a new, sorted array
  return events.sort((a, b) => a.iso.localeCompare(b.iso));
}