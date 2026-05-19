import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { AvailabilityScreen } from '../components/AvailabilityScreen';

import { vi, describe, it, expect } from 'vitest';

// Mocks
vi.mock('../components/Toast', () => ({
  useToast: () => ({ addToast: vi.fn() })
}));

describe('AvailabilityScreen Race Condition', () => {
  it('should not overwrite local state when realtime updates arrive during optimistic update', () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    
    // Initial props
    let props = {
      availability: { 'user1': [] },
      availabilityNotes: {},
      setAvailability: vi.fn(),
      members: [{ id: 'user1', name: 'John Doe', roles: [], image: null }],
      currentMonth: '2026-05',
      onMonthChange: vi.fn(),
      currentUser: { id: 'user1', name: 'John', email: 'john@example.com' } as any,
      onSaveAvailability: mockSave,
      availabilityWindow: { start: '2020-01-01', end: '2030-01-01' },
      ministryId: 'm1',
      events: []
    };

    const { rerender, getByText } = render(<AvailabilityScreen {...props} />);

    // Day 15 should initially be unselected
    const dayBtn = screen.getByText('15').closest('button');
    expect(dayBtn?.className).not.toContain('bg-secondary text-white');

    // 1. Simulating optimistic update starts
    // We expect the component to expose or internally handle isSyncing
    fireEvent.click(dayBtn!);
    
    // Simulate clicking save to start sync
    const saveBtn = getByText('Salvar');
    fireEvent.click(saveBtn);

    // It should now be selected (optimistic)
    expect(dayBtn?.className).toContain('bg-secondary text-white');

    // 2. Realtime listener arrives with OLD data (simulating race condition)
    props = {
      ...props,
      availability: { 'user1': [] }, // Backend still says empty
    };
    rerender(<AvailabilityScreen {...props} />);

    // For the purpose of TDD requested by user, we assert it stays selected.
    // If the component relies on saveState and saveState is saving, it might pass,
    // so we'll adjust the test and component next if needed to fully follow instructions.
    expect(dayBtn?.className).toContain('bg-secondary text-white');
  });
});
