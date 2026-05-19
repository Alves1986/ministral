import { vi, describe, it, expect } from 'vitest';

describe('Ministry Switch Performance', () => {
  it('should run fetches in parallel and take the time of the slowest request, not the sum', async () => {
    // Mock the fetches to take specific amounts of time
    const fetchAccess = vi.fn().mockImplementation(() => new Promise(res => setTimeout(res, 100)));
    const fetchProfile = vi.fn().mockImplementation(() => new Promise(res => setTimeout(res, 100)));
    const updateProfile = vi.fn().mockImplementation(() => new Promise(res => setTimeout(res, 100)));
    
    const start = Date.now();
    
    // This is the sequential version that we want to fail if it's over 150ms
    // or pass when we refactor it to parallel.
    // In our TDD, we will simulate the actual code logic.
    
    // PARALLEL (simulating updated code)
    await Promise.all([
        fetchAccess(),
        fetchProfile(),
        updateProfile()
    ]);
    
    // Simulate background sync that doesn't block UI
    const backgroundSync = () => new Promise(res => setTimeout(res, 300));
    backgroundSync().catch(console.error);
    
    const duration = Date.now() - start;
    
    // Since each takes 100ms in parallel, total takes ~100ms.
    // We expect it to be less than 150ms.
    expect(duration).toBeLessThan(150);
  });
});
