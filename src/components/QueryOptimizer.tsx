import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { logger } from '@/lib/logger';

/**
 * Centralized React Query configurations
 * These settings control caching behavior across the application
 */
export const reactQueryConfigs = {
  author: {
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
  },
  messages: {
    staleTime: 60 * 1000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  },
  communities: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  },
  events: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  },
  reactions: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  },
  'pinned-messages': {
    staleTime: 60 * 1000, // 1 minute - similar to messages
    gcTime: 10 * 60 * 1000, // 10 minutes - similar to messages
  },
  'thread-replies': {
    staleTime: 60 * 1000, // 1 minute - similar to messages
    gcTime: 10 * 60 * 1000, // 10 minutes - similar to messages
  },
  'user-status': {
    staleTime: 30 * 1000, // 30 seconds - needs to be fresh for presence
    gcTime: 5 * 60 * 1000, // 5 minutes - similar to reactions
  },
} as const;

interface QueryOptimizerProps {
  /** Whether to enable aggressive caching optimizations */
  enableAggressiveCaching?: boolean;
  /** Whether to enable query deduplication */
  enableDeduplication?: boolean;
  /** Whether to enable background cleanup */
  enableBackgroundCleanup?: boolean;
}

/**
 * Component that optimizes React Query behavior for better performance.
 * Should be placed near the root of the app to monitor all queries.
 */
export function QueryOptimizer({
  enableAggressiveCaching = true,
  enableDeduplication = true,
  enableBackgroundCleanup = true,
}: QueryOptimizerProps) {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const cleanupIntervalRef = useRef<NodeJS.Timeout>();

  // Optimize query defaults based on query patterns
  useEffect(() => {
    if (!enableAggressiveCaching) return;

    // Set optimized defaults for common query patterns
    const optimizations = [
      // Author queries - profile data changes infrequently
      {
        queryKey: ['author'],
        defaults: reactQueryConfigs.author,
      },
      // Message queries - need balance between real-time and performance
      {
        queryKey: ['messages'],
        defaults: reactQueryConfigs.messages,
      },
      // Community queries - relatively stable data
      {
        queryKey: ['communities'],
        defaults: reactQueryConfigs.communities,
      },
      // Event batch queries - events are immutable
      {
        queryKey: ['events-batch'],
        defaults: reactQueryConfigs.events,
      },
      // Reaction queries - change frequently but can tolerate some staleness
      {
        queryKey: ['reactions'],
        defaults: reactQueryConfigs.reactions,
      },
      // Pinned messages - similar caching to regular messages
      {
        queryKey: ['pinned-messages'],
        defaults: reactQueryConfigs['pinned-messages'],
      },
      // Thread replies - similar caching to regular messages
      {
        queryKey: ['thread-replies'],
        defaults: reactQueryConfigs['thread-replies'],
      },
      // User status - needs to be fresh for presence
      {
        queryKey: ['user-status'],
        defaults: reactQueryConfigs['user-status'],
      },
    ];

    optimizations.forEach(({ queryKey, defaults }) => {
      queryClient.setQueryDefaults(queryKey, defaults);
    });
  }, [queryClient, enableAggressiveCaching]);

  // Background cleanup of stale queries
  useEffect(() => {
    if (!enableBackgroundCleanup) return;

    const cleanup = () => {
      const cache = queryClient.getQueryCache();
      const queries = cache.getAll();
      const now = Date.now();

      let removedCount = 0;

      queries.forEach(query => {
        const { dataUpdatedAt, errorUpdatedAt } = query.state;
        const lastUpdated = Math.max(dataUpdatedAt || 0, errorUpdatedAt || 0);
        const age = now - lastUpdated;

        // Remove queries that are very old and have no observers
        if (age > 60 * 60 * 1000 && query.getObserversCount() === 0) { // 1 hour
          cache.remove(query);
          removedCount++;
        }
      });

      if (removedCount > 0) {
        logger.log(`Cleaned up ${removedCount} stale queries`);
      }
    };

    // Run cleanup every 5 minutes
    cleanupIntervalRef.current = setInterval(cleanup, 5 * 60 * 1000);

    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, [queryClient, enableBackgroundCleanup]);

  // Optimize query behavior when user changes
  useEffect(() => {
    if (!user?.pubkey) return;

    // Invalidate user-specific queries when user changes
    queryClient.invalidateQueries({
      predicate: (query) => {
        const queryKey = query.queryKey;
        return (
          queryKey.includes('user-communities') ||
          queryKey.includes('user-membership') ||
          queryKey.includes('direct-messages')
        );
      },
    });
  }, [user?.pubkey, queryClient]);

  // Set up query deduplication if enabled
  useEffect(() => {
    if (!enableDeduplication) return;

    const pendingQueries = new Map<string, Promise<unknown>>();

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.type === 'observerAdded' && event.query) {
        const queryKey = JSON.stringify(event.query.queryKey);

        // If we have a pending query with the same key, don't start a new one
        if (pendingQueries.has(queryKey)) {
          return;
        }

        // Track this query as pending
        if (event.query.state.status === 'pending') {
          const promise = new Promise((resolve) => {
            const checkStatus = () => {
              if (event.query.state.status !== 'pending') {
                pendingQueries.delete(queryKey);
                resolve(event.query.state.data);
              } else {
                setTimeout(checkStatus, 100);
              }
            };
            checkStatus();
          });

          pendingQueries.set(queryKey, promise);
        }
      }
    });

    return () => {
      unsubscribe();
      pendingQueries.clear();
    };
  }, [queryClient, enableDeduplication]);

  // This component doesn't render anything
  return null;
}

// Note: This component is used for side effects only and doesn't render anything