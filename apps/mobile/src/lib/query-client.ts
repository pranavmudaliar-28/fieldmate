import { QueryClient } from '@tanstack/react-query';

type ErrorWithStatus = { status?: number };

/** Server-state defaults — docs/03-architecture.md §3.3. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          const status = (error as ErrorWithStatus | null)?.status;
          if (status !== undefined && status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
        staleTime: 30_000,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
