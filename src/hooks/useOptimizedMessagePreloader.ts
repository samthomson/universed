import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useEventCache } from './useEventCache';
import { logger } from '@/lib/logger';
import type { NostrFilter } from '@nostrify/nostrify';

interface OptimizedMessagePreloaderProps {
  /** List of community-channel pairs to preload */
  preloadTargets: Array<{ communityId: string; channelId: string }>;
  /** Whether to enable preloading */
  enabled?: boolean;
}

/**
 * Optimized message preloader that batches multiple channel queries into single requests.
 * This dramatically reduces the number of network requests during initial app load.
 */
export function useOptimizedMessagePreloader({
  preloadTargets,
  enabled = true,
}: OptimizedMessagePreloaderProps) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { cacheEvents } = useEventCache();
  const hasPreloaded = useRef(false);

  useEffect(() => {
    if (!enabled || !user || hasPreloaded.current || preloadTargets.length === 0) {
      return;
    }

    const preloadMessages = async () => {
      try {
        logger.log(`[OptimizedPreloader] Starting batch preload for ${preloadTargets.length} channels`);

        // Group targets by community to minimize filter variations
        const communityGroups = preloadTargets.reduce((acc, target) => {
          if (!acc[target.communityId]) {
            acc[target.communityId] = [];
          }
          acc[target.communityId].push(target.channelId);
          return acc;
        }, {} as Record<string, string[]>);

        // Process each community group
        for (const [communityId, channelIds] of Object.entries(communityGroups)) {
          const [kind, pubkey, identifier] = communityId.split(':');
          if (!kind || !pubkey || !identifier) continue;

          // Build optimized filters for this community
          const filters: NostrFilter[] = [];

          // Handle general channel separately
          const hasGeneral = channelIds.includes('general');
          const specificChannels = channelIds.filter(id => id !== 'general');

          if (hasGeneral) {
            // General channel query
            filters.push({
              kinds: [1, 9411],
              '#a': [`${kind}:${pubkey}:${identifier}`],
              limit: 50, // Reduced limit for faster preloading
            });
          }

          if (specificChannels.length > 0) {
            // Specific channels query
            filters.push({
              kinds: [9411],
              '#a': [`${kind}:${pubkey}:${identifier}`],
              '#t': specificChannels,
              limit: specificChannels.length * 20, // 20 messages per channel max
            });
          }

          if (filters.length === 0) continue;

          try {
            const signal = AbortSignal.timeout(5000); // 5 second timeout for preloading
            const events = await nostr.query(filters, { signal });

            if (events.length > 0) {
              // Cache all events
              cacheEvents(events);

              // Prefetch into React Query cache for each channel
              channelIds.forEach(channelId => {
                const validEvents = events.filter(event => {
                  // Simple validation for preloading
                  if (![1, 9411].includes(event.kind)) return false;
                  if (event.tags.some(([name]) => name === 'e')) return false; // No replies

                  if (channelId === 'general') {
                    return !event.tags.some(([name]) => name === 't') ||
                           event.tags.some(([name, value]) => name === 't' && value === 'general');
                  } else {
                    return event.tags.some(([name, value]) => name === 't' && value === channelId);
                  }
                });

                if (validEvents.length > 0) {
                  const sortedEvents = validEvents.sort((a, b) => a.created_at - b.created_at);
                  queryClient.setQueryData(['messages', communityId, channelId], sortedEvents);
                  logger.log(`[OptimizedPreloader] Preloaded ${sortedEvents.length} messages for ${channelId}`);
                }
              });
            }
          } catch (error) {
            logger.warn(`[OptimizedPreloader] Failed to preload messages for community ${communityId}:`, error);
          }
        }

        hasPreloaded.current = true;
        logger.log(`[OptimizedPreloader] Completed batch preload for ${preloadTargets.length} channels`);
      } catch (error) {
        logger.error('[OptimizedPreloader] Preload failed:', error);
      }
    };

    // Start preloading after a short delay to let critical UI render first
    const timer = setTimeout(preloadMessages, 1000);
    return () => clearTimeout(timer);
  }, [enabled, user, preloadTargets, nostr, cacheEvents, queryClient]);
}