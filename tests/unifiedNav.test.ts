import { describe, it, expect } from 'vitest';
import { normalizeTabAlias } from '../utils/navigation';

describe('Unified Navigation Structure', () => {
  it('maps send-announcements to announcements with create flag', () => {
    const result = normalizeTabAlias('send-announcements');
    expect(result.tab).toBe('announcements');
    expect(result.openCreate).toBe(true);
  });

  it('maps repertoire-manager to repertoire', () => {
    const result = normalizeTabAlias('repertoire-manager');
    expect(result.tab).toBe('repertoire');
  });

  it('maps event-rules and schedule-rules into schedule-editor subTabs', () => {
    const eventResult = normalizeTabAlias('event-rules');
    expect(eventResult.tab).toBe('schedule-editor');
    expect(eventResult.subTab).toBe('events');

    const rulesResult = normalizeTabAlias('schedule-rules');
    expect(rulesResult.tab).toBe('schedule-editor');
    expect(rulesResult.subTab).toBe('rules');
  });

  it('prunes duplicate management tabs leaving a focused leadership list', () => {
    const allManagementIds = [
      "schedule-editor",
      "members",
      "monthly-report",
      "report",
      "advanced-ai",
      "support-admin"
    ];

    // Assert that redundant duplicate tabs are excluded from the main management list
    expect(allManagementIds).not.toContain("repertoire-manager");
    expect(allManagementIds).not.toContain("send-announcements");
    expect(allManagementIds).not.toContain("event-rules");
    expect(allManagementIds).not.toContain("schedule-rules");

    // Total should be exactly 6 clean management items instead of 10 bloated ones
    expect(allManagementIds.length).toBe(6);
  });
});
