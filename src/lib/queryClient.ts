import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 minutes
      staleTime: 1000 * 60 * 5,
      // Cache garbage collection after 30 minutes of inactivity
      gcTime: 1000 * 60 * 30,
      // Don't refetch on window focus (better for Firestore realtime)
      refetchOnWindowFocus: false,
      // Don't refetch on reconnect
      refetchOnReconnect: false,
      // Retry failed queries once
      retry: 1,
      // Retry delay
      retryDelay: 1000,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});