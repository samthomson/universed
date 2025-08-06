import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useEventCache } from './useEventCache';
import { useUserCommunities } from './useUserCommunities';
import { useCurrentUser } from './useCurrentUser';
import { logger } from '@/lib/logger';
import type { NostrFilter, NostrEvent } from '@nostrify/nostrify';
import { validateMessageEvent } from './useMessages';

interface LoadInfo {
  loadCount: number;
  lastLoadTime: number;
}

// Progressive backoff: 30s → 1min → 2min → 5min
const getBackoffDelay = (loadCount: number): number => {
  const delays = [30, 60, 120, 300]; // seconds
  const delayIndex = Math.min(loadCount, delays.length - 1);
  return delays[delayIndex] * 1000;
};

/**
 * Simple LRU background loader for inactive communities.
 * - Starts with user communities, prioritizes by membership level
 * - When user visits community: moves to top of LRU
 * - Progressive backoff, excludes active community
 */
export function useIntelligentLRU(activeCommunityId: string | null) {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { cacheEvents } = useEventCache();
  const { data: userCommunities } = useUserCommunities();
  const { user } = useCurrentUser();

  const loadInfoRef = useRef<Map<string, LoadInfo>>(new Map());
  const lruListRef = useRef<string[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const MAX_LRU_SIZE = 20;
  const BATCH_SIZE = 3;
  const INTERVAL = 30 * 1000; // 30 seconds

  // Initialize LRU with user communities
  const initializeLRU = useCallback(() => {
    if (!userCommunities?.length) return;

    // Sort by membership level, then alphabetically
    const sorted = [...userCommunities].sort((a, b) => {
      const levelPriority = { owner: 3, moderator: 2, approved: 1 };
      const aLevel = levelPriority[a.membershipStatus as keyof typeof levelPriority] || 1;
      const bLevel = levelPriority[b.membershipStatus as keyof typeof levelPriority] || 1;

      if (aLevel !== bLevel) return bLevel - aLevel;
      return (a.name || '').localeCompare(b.name || '');
    });

    lruListRef.current = sorted.slice(0, MAX_LRU_SIZE).map(c => c.id);
    logger.log(`[LRU] Initialized with ${lruListRef.current.length} communities`);
  }, [userCommunities]);

  // Add community to top of LRU
  const addToTop = useCallback((communityId: string) => {
    // Remove if exists
    lruListRef.current = lruListRef.current.filter(id => id !== communityId);

    // Add to top
    lruListRef.current.unshift(communityId);

    // Trim to max size
    if (lruListRef.current.length > MAX_LRU_SIZE) {
      lruListRef.current = lruListRef.current.slice(0, MAX_LRU_SIZE);
    }

    // Reset backoff
    loadInfoRef.current.delete(communityId);
    logger.log(`[LRU] Community moved to top: ${communityId}`);
  }, []);

  // Check if should skip loading
  const shouldSkip = useCallback((communityId: string): boolean => {
    if (communityId === activeCommunityId) return true;

    const loadInfo = loadInfoRef.current.get(communityId);
    if (!loadInfo) return false;

    const now = Date.now();
    const backoffDelay = getBackoffDelay(loadInfo.loadCount);
    return (now - loadInfo.lastLoadTime) < backoffDelay;
  }, [activeCommunityId]);

  // Load community batch (all channels like the old strategic loader)
  const loadBatch = useCallback(async (communityIds: string[]) => {
    if (!communityIds.length || !user?.pubkey) return;

    try {
      const filters: NostrFilter[] = [];

      for (const communityId of communityIds) {
        const [kind, pubkey, identifier] = communityId.split(':');
        if (!kind || !pubkey || !identifier) continue;

        // Load general channel (both kinds like useMessages does)
        filters.push({
          kinds: [1, 9411],
          '#a': [`${kind}:${pubkey}:${identifier}`],
          limit: 8, // Smaller limit since we're loading multiple channels
        });

        // Load recent channel messages (kind 9411 only for specific channels)
        filters.push({
          kinds: [9411],
          '#a': [`${kind}:${pubkey}:${identifier}`],
          limit: 5, // Even smaller for channel messages
        });
      }

      if (!filters.length) return;

      const events = await nostr.query(filters, { signal: AbortSignal.timeout(8000) });

      if (events.length > 0) {
        cacheEvents(events);

        // Group events by community and channel
        for (const communityId of communityIds) {
          const communityEvents = events.filter(event => {
            const communityRef = event.tags.find(([name]) => name === 'a')?.[1];
            return communityRef?.includes(communityId.split(':')[1]);
          });

          if (communityEvents.length > 0) {
            // Group by channel
            const eventsByChannel = new Map<string, NostrEvent[]>();

            for (const event of communityEvents) {
              // Determine channel
              const channelTag = event.tags.find(([name]) => name === 't')?.[1];
              const channelId = channelTag || 'general';

              // Validate event for this channel
              if (validateMessageEvent(event, channelId)) {
                if (!eventsByChannel.has(channelId)) {
                  eventsByChannel.set(channelId, []);
                }
                eventsByChannel.get(channelId)!.push(event);
              }
            }

            // Update cache for each channel
            for (const [channelId, channelEvents] of eventsByChannel) {
              if (channelEvents.length > 0) {
                const sortedEvents = channelEvents.sort((a, b) => a.created_at - b.created_at);

                queryClient.setQueryData(
                  ['messages', communityId, channelId],
                  (oldMessages: NostrEvent[] | undefined) => {
                    if (!oldMessages) return sortedEvents;

                    const existingIds = new Set(oldMessages.map(m => m.id));
                    const newMessages = sortedEvents.filter(m => !existingIds.has(m.id));

                    if (!newMessages.length) return oldMessages;

                    return [...oldMessages, ...newMessages].sort((a, b) => a.created_at - b.created_at);
                  }
                );
              }
            }
          }

          // Update load tracking
          const now = Date.now();
          const currentInfo = loadInfoRef.current.get(communityId);
          loadInfoRef.current.set(communityId, {
            loadCount: currentInfo ? currentInfo.loadCount + 1 : 1,
            lastLoadTime: now,
          });
        }

        logger.log(`[LRU] Loaded ${events.length} events for ${communityIds.length} communities`);
      }
    } catch (error) {
      logger.warn('[LRU] Load failed:', error);
    }
  }, [user?.pubkey, nostr, cacheEvents, queryClient]);

  // Run polling cycle
  const runPoll = useCallback(async () => {
    if (!lruListRef.current.length) return;

    const communitiesToLoad = lruListRef.current
      .filter(id => !shouldSkip(id))
      .slice(0, BATCH_SIZE);

    if (!communitiesToLoad.length) return;

    await loadBatch(communitiesToLoad);
  }, [shouldSkip, loadBatch]);

  // Start polling
  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(runPoll, INTERVAL);
    setTimeout(runPoll, 2000); // Run immediately with delay
  }, [runPoll, INTERVAL]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Initialize and start when communities available
  useEffect(() => {
    if (userCommunities?.length && user?.pubkey) {
      initializeLRU();
      startPolling();
    } else {
      stopPolling();
    }

    return stopPolling;
  }, [userCommunities, user?.pubkey, initializeLRU, startPolling, stopPolling]);

  return {
    addToTop,
    getLRUList: () => [...lruListRef.current],
    getLoadInfo: () => Object.fromEntries(loadInfoRef.current),
    isPolling: !!intervalRef.current,
    triggerPoll: runPoll,
  };
}