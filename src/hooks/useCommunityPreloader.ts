import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useEventCache } from './useEventCache';
import { logger } from '@/lib/logger';
import type { NostrFilter } from '@nostrify/nostrify';

const PRELOAD_DELAY = 300; // Wait 300ms before preloading (hover intent)
const PRELOAD_CACHE_TIME = 5 * 60 * 1000; // 5 minutes cache for preloaded data

/**
 * Hook for preloading community data on hover or other user interactions.
 * This provides instant loading when users actually navigate to communities.
 */
export function useCommunityPreloader() {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { cacheEvents } = useEventCache();

  const preloadTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const preloadedCommunities = useRef<Set<string>>(new Set());

  // Check if community data is already cached and fresh
  const isCommunityDataFresh = useCallback((communityId: string): boolean => {
    const messagesQuery = queryClient.getQueryState(['messages', communityId, 'general']);
    const channelsQuery = queryClient.getQueryState(['channels', communityId]);

    const now = Date.now();
    const isMessagesFresh = messagesQuery?.dataUpdatedAt &&
                           (now - messagesQuery.dataUpdatedAt) < PRELOAD_CACHE_TIME;
    const isChannelsFresh = channelsQuery?.dataUpdatedAt &&
                           (now - channelsQuery.dataUpdatedAt) < PRELOAD_CACHE_TIME;

    return !!(isMessagesFresh && isChannelsFresh);
  }, [queryClient]);

  // Preload essential community data
  const preloadCommunityData = useCallback(async (communityId: string): Promise<void> => {
    // Skip if already preloaded recently or data is fresh
    if (preloadedCommunities.current.has(communityId) || isCommunityDataFresh(communityId)) {
      return;
    }

    try {
      const [kind, pubkey, identifier] = communityId.split(':');
      if (!kind || !pubkey || !identifier) return;

      // Create efficient batched query for essential data
      const filters: NostrFilter[] = [
        // Recent messages for general channel (most commonly accessed)
        {
          kinds: [1, 9411],
          '#a': [`${kind}:${pubkey}:${identifier}`],
          limit: 30, // Smaller limit for preloading
        },
        // Channel definitions
        {
          kinds: [40, 41], // Channel creation and metadata
          '#a': [`${kind}:${pubkey}:${identifier}`],
          limit: 20,
        },
        // Recent reactions (for immediate display)
        {
          kinds: [7],
          '#a': [`${kind}:${pubkey}:${identifier}`],
          limit: 20,
        }
      ];

      // Use shorter timeout for preloading to avoid blocking
      const signal = AbortSignal.timeout(3000);
      const events = await nostr.query(filters, { signal });

      if (events.length > 0) {
        // Cache the events
        cacheEvents(events);

        // Separate events by type and cache appropriately
        const messageEvents = events
          .filter(event => [1, 9411].includes(event.kind))
          .sort((a, b) => a.created_at - b.created_at);

        const channelEvents = events.filter(event => [40, 41].includes(event.kind));
        const reactionEvents = events.filter(event => event.kind === 7);

        // Cache messages for general channel
        if (messageEvents.length > 0) {
          queryClient.setQueryData(
            ['messages', communityId, 'general'],
            messageEvents,
            {
              updatedAt: Date.now(),
            }
          );
        }

        // Cache channel data
        if (channelEvents.length > 0) {
          // Transform channel events to channel objects (simplified)
          const channels = channelEvents.map(event => ({
            id: event.tags.find(([name]) => name === 'd')?.[1] || 'general',
            name: event.tags.find(([name]) => name === 'name')?.[1] || 'general',
            type: 'text' as const,
            description: event.tags.find(([name]) => name === 'about')?.[1],
            event,
          }));

          queryClient.setQueryData(
            ['channels', communityId],
            channels,
            {
              updatedAt: Date.now(),
            }
          );
        }

        // Cache reactions
        if (reactionEvents.length > 0) {
          queryClient.setQueryData(
            ['reactions', communityId],
            reactionEvents,
            {
              updatedAt: Date.now(),
            }
          );
        }

        // Mark as preloaded
        preloadedCommunities.current.add(communityId);

        logger.log(`Preloaded data for community ${communityId}: ${events.length} events`);
      }
    } catch (error) {
      // Silently handle preload errors
      logger.warn(`Preload failed for community ${communityId}:`, error);
    }
  }, [nostr, cacheEvents, queryClient, isCommunityDataFresh]);

  // Start preloading with delay (hover intent detection)
  const startPreload = useCallback((communityId: string) => {
    // Clear any existing timeout for this community
    const existingTimeout = preloadTimeouts.current.get(communityId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      preloadCommunityData(communityId);
      preloadTimeouts.current.delete(communityId);
    }, PRELOAD_DELAY);

    preloadTimeouts.current.set(communityId, timeout);
  }, [preloadCommunityData]);

  // Cancel preloading (user moved away)
  const cancelPreload = useCallback((communityId: string) => {
    const timeout = preloadTimeouts.current.get(communityId);
    if (timeout) {
      clearTimeout(timeout);
      preloadTimeouts.current.delete(communityId);
    }
  }, []);

  // Immediate preload (for high-priority scenarios)
  const preloadImmediately = useCallback((communityId: string) => {
    // Cancel any delayed preload
    cancelPreload(communityId);
    // Start immediate preload
    preloadCommunityData(communityId);
  }, [cancelPreload, preloadCommunityData]);

  // Clear preload cache (useful for testing or memory management)
  const clearPreloadCache = useCallback(() => {
    preloadedCommunities.current.clear();

    // Clear all pending timeouts
    preloadTimeouts.current.forEach(timeout => clearTimeout(timeout));
    preloadTimeouts.current.clear();
  }, []);

  // Get preload statistics
  const getPreloadStats = useCallback(() => {
    return {
      preloadedCount: preloadedCommunities.current.size,
      pendingCount: preloadTimeouts.current.size,
      preloadedCommunities: Array.from(preloadedCommunities.current),
    };
  }, []);

  return {
    startPreload,
    cancelPreload,
    preloadImmediately,
    clearPreloadCache,
    getPreloadStats,
  };
}