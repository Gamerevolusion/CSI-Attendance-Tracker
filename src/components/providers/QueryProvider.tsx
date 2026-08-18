"use client";

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { queryClient as defaultQueryClient } from '@/lib/queryClient';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Use a stable queryClient instance to prevent re-creating on render
  const [queryClient] = useState(() => defaultQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}