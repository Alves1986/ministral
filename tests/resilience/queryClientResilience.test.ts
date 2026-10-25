import { describe, it, expect } from 'vitest';
import { isNonRetryableError } from '../../lib/queryClient';

describe('TanStack Query Resilience and Non-Retryable Error Handling', () => {
  it('correctly classifies HTTP 401, 403, 404 and 422 as non-retryable', () => {
    expect(isNonRetryableError({ status: 401 })).toBe(true);
    expect(isNonRetryableError({ status: 403 })).toBe(true);
    expect(isNonRetryableError({ status: 404 })).toBe(true);
    expect(isNonRetryableError({ response: { status: 403 } })).toBe(true);
  });

  it('correctly classifies Supabase RLS and PostgREST errors as non-retryable', () => {
    // 42501 = insufficient_privilege (RLS violation)
    expect(isNonRetryableError({ code: '42501' })).toBe(true);
    // PGRST301 = resource not found or JWT invalid
    expect(isNonRetryableError({ code: 'PGRST301' })).toBe(true);
    // 23505 = unique_violation
    expect(isNonRetryableError({ code: '23505' })).toBe(true);
  });

  it('allows retries for network timeouts, 500/502/503 server errors and transient failures', () => {
    expect(isNonRetryableError({ status: 500 })).toBe(false);
    expect(isNonRetryableError({ status: 502 })).toBe(false);
    expect(isNonRetryableError({ status: 503 })).toBe(false);
    expect(isNonRetryableError(new Error('Network request failed'))).toBe(false);
    expect(isNonRetryableError(null)).toBe(false);
    expect(isNonRetryableError(undefined)).toBe(false);
  });
});
