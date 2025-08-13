/**
 * React Query provider for data management
 */

import React, { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { toast } from 'sonner';

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * Global error handler for queries
 */
const handleQueryError = (error: Error) => {
  console.error('Query error:', error);
  if (typeof window !== 'undefined') {
    const isNetwork = /Failed to fetch|NetworkError|ERR_NETWORK/i.test(error.message);
    toast.error(isNetwork ? 'Network error. Please check your connection.' : error.message || 'Something went wrong loading data');
  }
};

/**
 * Global error handler for mutations
 */
const handleMutationError = (error: Error) => {
  console.error('Mutation error:', error);
  if (typeof window !== 'undefined') {
    toast.error(error.message || 'Action failed. Changes were not saved.');
  }
};

/**
 * Create QueryClient with proper configuration
 */
const createQueryClient = () => {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => handleQueryError(error as Error),
    }),
    mutationCache: new MutationCache({
      onError: (error) => handleMutationError(error as Error),
    }),
    defaultOptions: {
      queries: {
        // Stale time: how long data is considered fresh
        staleTime: 5 * 60 * 1000, // 5 minutes
        // Cache time: how long data stays in cache when not used
        gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
        // Retry configuration with exponential backoff
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors (client errors)
          if (error instanceof Error && (
            error.message.includes('400') ||
            error.message.includes('401') ||
            error.message.includes('403') ||
            error.message.includes('404')
          )) {
            return false;
          }
          // In dev, only retry once to avoid long exponential backoff stalls
          const isDev = import.meta?.env?.MODE !== 'production';
          return failureCount < (isDev ? 1 : 3);
        },
        // Exponential backoff retry delay (shorter in dev)
        retryDelay: (attemptIndex) => {
          const isDev = import.meta?.env?.MODE !== 'production';
          const base = isDev ? 300 : 1000;
          const cap = isDev ? 3000 : 30000;
          return Math.min(base * 2 ** attemptIndex, cap);
        },
        // Refetch on window focus (useful for keeping data fresh)
        refetchOnWindowFocus: false,
        // Refetch on reconnect
        refetchOnReconnect: true,
        // Network mode handling
        networkMode: 'online',
      },
      mutations: {
        // Retry mutations once on failure with delay
        retry: (failureCount, error) => {
          // Don't retry client errors
          if (error instanceof Error && (
            error.message.includes('400') ||
            error.message.includes('401') ||
            error.message.includes('403') ||
            error.message.includes('404')
          )) {
            return false;
          }
          const isDev = import.meta?.env?.MODE !== 'production';
          return failureCount < (isDev ? 1 : 2);
        },
        // Retry delay for mutations (shorter in dev)
        retryDelay: (attemptIndex) => {
          const isDev = import.meta?.env?.MODE !== 'production';
          const base = isDev ? 300 : 1000;
          const cap = isDev ? 3000 : 10000;
          return Math.min(base * 2 ** attemptIndex, cap);
        },
        // Network mode handling
        networkMode: 'online',
      },
    },
  });
};

// Create a single instance to avoid recreating on every render
const queryClient = createQueryClient();

/**
 * QueryProvider component that wraps the app with React Query
 */
export const QueryProvider: React.FC<QueryProviderProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

export default QueryProvider;