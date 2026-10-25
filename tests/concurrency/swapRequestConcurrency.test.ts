import { describe, it, expect } from 'vitest';

describe('Swap Request Race Condition & Concurrency', () => {
  interface SwapRequest {
    id: string;
    status: 'pending' | 'accepted' | 'rejected';
    claimedBy?: string;
  }

  it('guarantees only one volunteer can accept an open swap request when multiple accept simultaneously', async () => {
    let swap: SwapRequest = {
      id: 'swap-req-42',
      status: 'pending',
    };

    // Simulated atomic compare-and-swap database operation
    const acceptSwap = async (volunteerId: string): Promise<{ success: boolean; error?: string }> => {
      // Simulate network latency jitter
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 30) + 10));

      if (swap.status !== 'pending') {
        return { success: false, error: 'Esta vaga de substituição já foi preenchida por outro voluntário.' };
      }

      // Atomic claim
      swap = {
        ...swap,
        status: 'accepted',
        claimedBy: volunteerId,
      };

      return { success: true };
    };

    const volunteers = ['vol-Ana', 'vol-Carlos', 'vol-Beatriz', 'vol-Daniel'];

    const results = await Promise.all(volunteers.map((vol) => acceptSwap(vol)));

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    expect(successCount).toBe(1);
    expect(failureCount).toBe(3);
    expect(swap.status).toBe('accepted');
    expect(volunteers).toContain(swap.claimedBy);
  });
});
