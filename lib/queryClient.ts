import { QueryClient } from '@tanstack/react-query';

const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404, 422]);
const NON_RETRYABLE_CODES = new Set(['PGRST301', '42501', '23505', '23503']);

export const isNonRetryableError = (error: any): boolean => {
  if (!error) return false;
  const status = error.status || error.statusCode || error?.response?.status;
  if (status && NON_RETRYABLE_STATUSES.has(Number(status))) {
    return true;
  }
  const code = error.code || error?.error?.code;
  if (code && NON_RETRYABLE_CODES.has(String(code))) {
    return true;
  }
  return false;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos de validade do cache
      gcTime: 1000 * 60 * 60, // 1 hora de retenção em memória
      refetchOnWindowFocus: true,
      retry: (failureCount, error: any) => {
        if (isNonRetryableError(error)) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => {
        // Backoff exponencial com jitter (máximo 30 segundos)
        const baseDelay = 1000 * Math.pow(2, attemptIndex);
        const jitter = Math.random() * 500;
        return Math.min(baseDelay + jitter, 30000);
      },
    },
    mutations: {
      retry: (failureCount, error: any) => {
        if (isNonRetryableError(error)) {
          return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => {
        const baseDelay = 800 * Math.pow(2, attemptIndex);
        const jitter = Math.random() * 300;
        return Math.min(baseDelay + jitter, 10000);
      },
    },
  },
});
