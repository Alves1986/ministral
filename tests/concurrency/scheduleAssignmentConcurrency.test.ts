import { describe, it, expect } from 'vitest';

describe('Schedule Assignment Concurrency & Pipe Separator Integrity', () => {
  const buildScheduleKey = (ruleId: string, date: string, role: string) => {
    // Mandated rule: ruleId|date|role using pipe separator
    return `${ruleId}|${date}|${role}`;
  };

  const parseScheduleKey = (key: string) => {
    const parts = key.split('|');
    return {
      ruleId: parts[0],
      date: parts[1],
      role: parts.slice(2).join('|'), // Preserves role if it contains special characters
    };
  };

  it('strictly preserves the pipe separator and compound key format', () => {
    const ruleId = 'rule-uuid-123';
    const date = '2026-11-15';
    const role = 'Vocal Soprano';

    const key = buildScheduleKey(ruleId, date, role);
    expect(key).toBe('rule-uuid-123|2026-11-15|Vocal Soprano');
    expect(key.split('|')).toHaveLength(3);

    const parsed = parseScheduleKey(key);
    expect(parsed.ruleId).toBe(ruleId);
    expect(parsed.date).toBe(date);
    expect(parsed.role).toBe(role);
  });

  it('allows independent cell concurrent processing without locking other cells', async () => {
    // Simulating ScheduleEditor processingCells Set
    const processingCells = new Set<string>();

    const assignVolunteer = async (key: string, volunteerId: string, delayMs: number) => {
      if (processingCells.has(key)) {
        throw new Error(`Cell ${key} is already locked by another operation`);
      }
      processingCells.add(key);

      try {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return { success: true, key, volunteerId };
      } finally {
        processingCells.delete(key);
      }
    };

    const cell1 = buildScheduleKey('rule-1', '2026-11-01', 'Violão');
    const cell2 = buildScheduleKey('rule-1', '2026-11-01', 'Bateria');
    const cell3 = buildScheduleKey('rule-2', '2026-11-08', 'Ministro');

    // Concurrently assigning 3 different cells should all succeed simultaneously
    const results = await Promise.all([
      assignVolunteer(cell1, 'user-A', 50),
      assignVolunteer(cell2, 'user-B', 40),
      assignVolunteer(cell3, 'user-C', 30),
    ]);

    expect(results).toHaveLength(3);
    expect(results[0].volunteerId).toBe('user-A');
    expect(results[1].volunteerId).toBe('user-B');
    expect(results[2].volunteerId).toBe('user-C');
    expect(processingCells.size).toBe(0);
  });

  it('prevents duplicate assignment on the exact same cell simultaneously', async () => {
    const processingCells = new Set<string>();

    const assignVolunteer = async (key: string, volunteerId: string) => {
      if (processingCells.has(key)) {
        throw new Error(`Conflict: Cell ${key} is currently processing`);
      }
      processingCells.add(key);

      try {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { success: true, volunteerId };
      } finally {
        processingCells.delete(key);
      }
    };

    const targetCell = buildScheduleKey('rule-1', '2026-11-01', 'Teclado');

    const [first, second] = await Promise.allSettled([
      assignVolunteer(targetCell, 'leader-1-choice'),
      assignVolunteer(targetCell, 'leader-2-choice'),
    ]);

    expect(first.status === 'fulfilled' || second.status === 'fulfilled').toBe(true);
    expect(first.status === 'rejected' || second.status === 'rejected').toBe(true);
  });
});
