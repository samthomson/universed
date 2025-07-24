import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useUserCommunities } from './useUserCommunities';
import { useQueryDeduplication } from './useQueryDeduplication';
import type { NostrFilter } from '@nostrify/nostrify';

interface PrefetchState {
  lastPrefetchTime: number;
  prefetchedCommunities: Set<string>;
  prefetchedAuthors: Set<string>;
  isActive: boolean;
}

const PREFETCH_DELAY = 3000; // Wait 3 seconds after initial load
const PREFETCH_COOLDOWN = 60000; // 1 minute between prefetch cycles
const MAX_AUTHORS_PER_BATCH = 20; // Limit author prefetching
const MAX_COMMUNITIES_TO_PREFETCH = 5; // Limit community prefetching

/**
 * Hook that intelligently prefetches data the user is likely to need,
 * improving perceived performance by loading content before it's requested.
 */
export function useSmartPrefetch() {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { data: userCommunities } = useUserCommunities();
  const { prefetchQuery, getCachedData } = useQueryDeduplication();

  const stateRef = useRef<PrefetchState>({
    lastPrefetchTime: 0,
    prefetchedCommunities: new Set(),
    prefetchedAuthors: new Set(),
    isActive: false,
  });

  const timeoutRef = useRef<NodeJS.Timeout>();

  // Prefetch author profiles for a list of pubkeys
  const prefetchAuthors = useCallback(async (pubkeys: string[]): Promise<void> => {
    if (!user?.pubkey || pubkeys.length === 0) return;

    // Filter out already prefetched authors
    const newPubkeys = pubkeys.filter(pubkey =>
      !stateRef.current.prefetchedAuthors.has(pubkey) &&
      !getCachedData(['author', pubkey])
    ).slice(0, MAX_AUTHORS_PER_BATCH);

    if (newPubkeys.length === 0) return;

    try {
      const filters: NostrFilter[] = [{
        kinds: [0],
        authors: newPubkeys,
        limit: newPubkeys.length,
      }];

      await prefetchQuery(
        ['authors-prefetch', newPubkeys.sort().join(',')],
        async () => {
          const events = await nostr.query(filters, {
            signal: AbortSignal.timeout(3000)
          });

          // Cache individual authors
          events.forEach(event => {
            try {
              const metadata = JSON.parse(event.content);
              queryClient.setQueryData(['author', event.pubkey], { metadata, event });
            } catch {
              queryClient.setQueryData(['author', event.pubkey], { event });
            }
          });

          return events;
        },
        10 * 60 * 1000 // 10 minutes
      );

      // Mark as prefetched
      newPubkeys.forEach(pubkey => {
        stateRef.current.prefetchedAuthors.add(pubkey);
      });

      console.log(`Prefetched ${newPubkeys.length} author profiles`);
    } catch (error) {
      console.warn('Author prefetch failed:', error);
    }
  }, [user?.pubkey, nostr, queryClient, prefetchQuery, getCachedData]);

  // Prefetch recent messages for a community
  const prefetchCommunityMessages = useCallback(async (communityId: string): Promise<void> => {
    if (!user?.pubkey || stateRef.current.prefetchedCommunities.has(communityId)) return;

    // Check if we already have recent data
    const existingData = getCachedData(['messages', communityId, 'general']);
    if (existingData) return;

    try {
      const [kind, pubkey, identifier] = communityId.split(':');
      if (!kind || !pubkey || !identifier) return;

      const filters: NostrFilter[] = [{
        kinds: [1, 9411], // Messages
        '#a': [`${kind}:${pubkey}:${identifier}`],
        limit: 30, // Smaller limit for prefetching
      }];

      await prefetchQuery(
        ['messages-prefetch', communityId, 'general'],
        async () => {
          const events = await nostr.query(filters, {
            signal: AbortSignal.timeout(4000)
          });

          // Cache the messages
          if (events.length > 0) {
            const sortedEvents = events.sort((a, b) => a.created_at - b.created_at);
            queryClient.setQueryData(['messages', communityId, 'general'], sortedEvents);

            // Extract and prefetch author profiles from messages
            const authorPubkeys = [...new Set(events.map(e => e.pubkey))];
            if (authorPubkeys.length > 0) {
              // Don't await this to avoid blocking
              prefetchAuthors(authorPubkeys);
            }
          }

          return events;
        },
        5 * 60 * 1000 // 5 minutes
      );

      stateRef.current.prefetchedCommunities.add(communityId);
      console.log(`Prefetched messages for community: ${communityId}`);
    } catch (error) {
      console.warn('Community prefetch failed:', error);
    }
  }, [user?.pubkey, nostr, queryClient, prefetchQuery, getCachedData, prefetchAuthors]);

  // Prefetch user's most active communities
  const prefetchUserCommunities = useCallback(async (): Promise<void> => {
    if (!userCommunities || userCommunities.length === 0) return;

    // Prioritize communities by membership status
    const prioritizedCommunities = userCommunities
      .filter(community => !stateRef.current.prefetchedCommunities.has(community.id))
      .sort((a, b) => {
        const statusOrder = { owner: 0, moderator: 1, approved: 2 };
        return statusOrder[a.membershipStatus] - statusOrder[b.membershipStatus];
      })
      .slice(0, MAX_COMMUNITIES_TO_PREFETCH);

    // Prefetch communities sequentially to avoid overwhelming the relay
    for (const community of prioritizedCommunities) {
      await prefetchCommunityMessages(community.id);
      // Small delay between communities
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }, [userCommunities, prefetchCommunityMessages]);

  // Extract authors from current page content for prefetching
  const extractVisibleAuthors = useCallback((): string[] => {
    const authors = new Set<string>();

    // Get all current query data and extract pubkeys
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();

    queries.forEach(query => {
      const data = query.state.data;
      if (Array.isArray(data)) {
        data.forEach((item: unknown) => {
          if (item && typeof item === 'object' && 'pubkey' in item) {
            authors.add((item as { pubkey: string }).pubkey);
          }
        });
      } else if (data && typeof data === 'object' && 'pubkey' in data) {
        authors.add((data as { pubkey: string }).pubkey);
      }
    });

    return Array.from(authors);
  }, [queryClient]);

  // Main prefetch function
  const executePrefetch = useCallback(async (): Promise<void> => {
    const now = Date.now();
    const state = stateRef.current;

    // Check cooldown
    if (now - state.lastPrefetchTime < PREFETCH_COOLDOWN) return;

    state.isActive = true;
    state.lastPrefetchTime = now;

    try {
      // 1. Prefetch visible authors first (highest priority)
      const visibleAuthors = extractVisibleAuthors();
      if (visibleAuthors.length > 0) {
        await prefetchAuthors(visibleAuthors);
      }

      // 2. Prefetch user's communities
      await prefetchUserCommunities();

      console.log('Smart prefetch cycle completed');
    } catch (error) {
      console.warn('Prefetch cycle failed:', error);
    } finally {
      state.isActive = false;
    }
  }, [extractVisibleAuthors, prefetchAuthors, prefetchUserCommunities]);

  // Start prefetching after initial load
  useEffect(() => {
    if (!user?.pubkey) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Start prefetching after delay
    timeoutRef.current = setTimeout(() => {
      executePrefetch();
    }, PREFETCH_DELAY);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [user?.pubkey, executePrefetch]);

  // Trigger prefetch when user communities change
  useEffect(() => {
    if (userCommunities && userCommunities.length > 0) {
      // Reset prefetched communities when the list changes
      stateRef.current.prefetchedCommunities.clear();

      // Trigger prefetch after a short delay
      setTimeout(() => {
        executePrefetch();
      }, 1000);
    }
  }, [userCommunities, executePrefetch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Public API
  const triggerPrefetch = useCallback(() => {
    executePrefetch();
  }, [executePrefetch]);

  const getPrefetchStats = useCallback(() => {
    return {
      isActive: stateRef.current.isActive,
      prefetchedCommunities: stateRef.current.prefetchedCommunities.size,
      prefetchedAuthors: stateRef.current.prefetchedAuthors.size,
      lastPrefetchTime: stateRef.current.lastPrefetchTime,
    };
  }, []);

  const clearPrefetchCache = useCallback(() => {
    stateRef.current.prefetchedCommunities.clear();
    stateRef.current.prefetchedAuthors.clear();
  }, []);

  return {
    triggerPrefetch,
    getPrefetchStats,
    clearPrefetchCache,
  };
}

/**
 * Lightweight hook that just enables smart prefetching without exposing controls.
 */
export function useEnableSmartPrefetch() {
  useSmartPrefetch();
}