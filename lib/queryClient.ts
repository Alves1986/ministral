
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes cache validity
      gcTime: 1000 * 60 * 60, // 1 hour garbage collection
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});
