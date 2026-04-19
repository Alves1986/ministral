
import { describe, it, expect } from 'vitest';
import { getMonthName, adjustMonth } from '../utils/dateUtils';

describe('Date Utilities', () => {
  it('should return correct month name', () => {
    expect(getMonthName('2023-01')).toBe('Janeiro');
    expect(getMonthName('2023-12')).toBe('Dezembro');
  });

  it('should adjust month correctly', () => {
    expect(adjustMonth('2023-01', 1)).toBe('2023-02');
    expect(adjustMonth('2023-12', 1)).toBe('2024-01');
    expect(adjustMonth('2023-01', -1)).toBe('2022-12');
  });
});
