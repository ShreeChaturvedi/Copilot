/**
 * React Query provider for data management
 */

import React, { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * Global error handler for queries
 */
const handleQueryError = (error: Error) => {
  console.error('Query error:', error);
  
  // In a real app, you might want to show a toast notification
  // For now, we'll just log the error
  // TODO: Integrate with a toast notification system
  if (error.message.includes('Failed to fetch')) {
    console.warn('Network error detected - user may be offline');
  }
};

/**
 * Global error handler for mutations
 */
const handleMutationError = (error: Error) => {
  console.error('Mutation error:', error);
  
  // Show user-friendly error messages
  // TODO: Integrate with a toast notification system
  if (error.message.includes('Failed to save')) {
    console.warn('Save operation failed - data may not be persisted');
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
          // Retry up to 3 times for other errors
          return failureCount < 3;
        },
        // Exponential backoff retry delay
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
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
          return failureCount < 2;
        },
        // Retry delay for mutations
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
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