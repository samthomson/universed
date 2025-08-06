import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useEventCache } from './useEventCache';
import { useUserCommunities } from './useUserCommunities';
import { useCurrentUser } from './useCurrentUser';
import { logger } from '@/lib/logger';
import type { NostrFilter, NostrEvent } from '@nostrify/nostrify';

interface LoadingPriority {
  communityId: string;
  priority: number;
  lastVisited: number;
  membershipStatus: 'owner' | 'moderator' | 'approved' | 'pending' | 'declined' | 'banned' | 'not-member';
  hasUnreadActivity?: boolean;
}

interface LoadingState {
  isLoading: boolean;
  currentLoadingCommunity: string | null;
  loadedCommunities: Map<string, number>; // communityId -> timestamp
  loadedChannels: Map<string, number>; // communityId:channelId -> timestamp
  priorityQueue: LoadingPriority[];
  activeQueries: Set<string>;
}

// Configuration constants
const IDLE_DETECTION_DELAY = 1500; // Start loading after 1.5s of inactivity
const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes cache validity
const PRIORITY_CACHE_MAX_AGE = 10 * 60 * 1000; // 10 minutes for high priority communities
const BATCH_SIZE = 2; // Load 2 communities at once
const CHANNEL_BATCH_SIZE = 3; // Load 3 channels at once
const MAX_EVENTS_PER_QUERY = 30; // Limit events per query for performance
const INTER_BATCH_DELAY = 1000; // 1 second between batches
const INTER_CHANNEL_DELAY = 500; // 500ms between channel loads

/**
 * Strategic background loader that intelligently preloads community and channel data
 * based on user behavior, membership status, and activity patterns.
 */
export function useStrategicBackgroundLoader() {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { cacheEvents } = useEventCache();
  const { data: userCommunities } = useUserCommunities();
  const { user } = useCurrentUser();

  const stateRef = useRef<LoadingState>({
    isLoading: false,
    currentLoadingCommunity: null,
    loadedCommunities: new Map(),
    loadedChannels: new Map(),
    priorityQueue: [],
    activeQueries: new Set(),
  });

  const idleTimeoutRef = useRef<NodeJS.Timeout>();
  const loadingAbortControllerRef = useRef<AbortController>();
  const startStrategicLoadingRef = useRef<(() => Promise<void>) | null>(null);

  // Track user activity to detect idle periods
  const trackActivity = useCallback(() => {
    // Cancel any existing idle timeout
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }

    // Abort any ongoing background loading when user becomes active
    if (loadingAbortControllerRef.current && stateRef.current.isLoading) {
      loadingAbortControllerRef.current.abort();
      stateRef.current.isLoading = false;
      stateRef.current.currentLoadingCommunity = null;
    }

    // Set new idle timeout
    idleTimeoutRef.current = setTimeout(() => {
      const loadingFn = startStrategicLoadingRef.current;
      if (loadingFn) {
        loadingFn();
      }
    }, IDLE_DETECTION_DELAY);
  }, []);

  // Calculate priority for each community
  const calculateCommunityPriority = useCallback((community: {
    id: string;
    membershipStatus: 'owner' | 'moderator' | 'approved' | 'pending' | 'declined' | 'banned' | 'not-member';
  }): number => {
    let priority = 0;

    // Membership status priority
    switch (community.membershipStatus) {
      case 'owner':
        priority += 100;
        break;
      case 'moderator':
        priority += 50;
        break;
      case 'approved':
        priority += 10;
        break;
    }

    // Check last visit time from localStorage
    const visitHistory = localStorage.getItem('community-visit-history');
    if (visitHistory) {
      try {
        const history = JSON.parse(visitHistory);
        const lastVisit = history[community.id];
        if (lastVisit) {
          const daysSinceVisit = (Date.now() - lastVisit) / (1000 * 60 * 60 * 24);
          // Higher priority for recently visited communities
          priority += Math.max(0, 50 - daysSinceVisit * 5);
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    // Check if community has cached data
    const hasCachedData = queryClient.getQueryData(['messages', community.id, 'general']);
    if (!hasCachedData) {
      priority += 20; // Higher priority for communities without any cached data
    }

    return priority;
  }, [queryClient]);

  // Check if cache is still valid
  const isCacheValid = useCallback((queryKey: string[], maxAge: number = CACHE_MAX_AGE): boolean => {
    const queryState = queryClient.getQueryState(queryKey);
    if (!queryState?.dataUpdatedAt) return false;

    const age = Date.now() - queryState.dataUpdatedAt;
    return age < maxAge;
  }, [queryClient]);

  // Load events for a specific channel
  const loadChannelEvents = useCallback(async (
    communityId: string,
    channelId: string,
    signal: AbortSignal
  ): Promise<void> => {
    const cacheKey = ['messages', communityId, channelId];

    // Skip if cache is still valid
    if (isCacheValid(cacheKey)) {
      return;
    }

    try {
      const [kind, pubkey, identifier] = communityId.split(':');
      if (!kind || !pubkey || !identifier) return;

      const filters: NostrFilter[] = [];

      if (channelId === 'general') {
        // For general channel, load both kinds
        filters.push({
          kinds: [1, 9411],
          '#a': [`${kind}:${pubkey}:${identifier}`],
          limit: MAX_EVENTS_PER_QUERY,
        });
      } else {
        // For specific channels, only load channel messages
        filters.push({
          kinds: [9411],
          '#t': [channelId],
          '#a': [`${kind}:${pubkey}:${identifier}`],
          limit: MAX_EVENTS_PER_QUERY,
        });
      }

      const events = await nostr.query(filters, { signal });

      if (events.length > 0) {
        // Cache events
        cacheEvents(events);

        // Filter and sort events using the SAME validation as useMessages
        // This ensures consistency across all message queries
        const validEvents = events.filter(event => {
          // Import the validation logic inline to avoid circular dependencies
          // Accept kind 9411 (channel chat messages) and kind 1 (legacy)
          if (![1, 9411].includes(event.kind)) return false;

          // AGGRESSIVE FILTERING: Exclude ALL events with e-tags from main chat feed
          const eTags = event.tags.filter(([name]) => name === 'e');
          if (eTags.length > 0) {
            return false; // Any event with e-tags is filtered out
          }

          // For kind 9411, we MUST have the correct channel tag
          if (event.kind === 9411) {
            const eventChannelTag = event.tags.find(([name]) => name === 't')?.[1];
            if (!eventChannelTag || eventChannelTag !== channelId) {
              return false; // Message doesn't belong to this channel
            }
          }

          // For kind 1 (legacy), only allow if it has the correct channel tag OR no channel tag at all
          if (event.kind === 1) {
            const eventChannelTag = event.tags.find(([name]) => name === 't')?.[1];
            if (eventChannelTag && eventChannelTag !== channelId) {
              return false; // Message has a different channel tag
            }
            // If no channel tag and we're in general channel, allow it (legacy support)
            if (!eventChannelTag && channelId !== 'general') {
              return false; // Untagged messages only go to general channel
            }
          }

          return true;
        });

        // CRITICAL FIX: DO NOT set message query data directly!
        // The background loader should ONLY cache individual events.
        // Let useMessages be the single source of truth for message queries.
        // This prevents race conditions where the background loader overwrites
        // properly filtered data from useMessages.

        // Just mark the channel as loaded - don't update the query cache
        logger.log(`[StrategicBackgroundLoader] Cached ${validEvents.length} events for channel ${channelId}, but NOT updating message query cache`);

        // Mark channel as loaded
        stateRef.current.loadedChannels.set(`${communityId}:${channelId}`, Date.now());
      }
    } catch (error) {
      if (!signal.aborted) {
        logger.warn(`Failed to load channel ${channelId} for community ${communityId}:`, error);
      }
    }
  }, [nostr, cacheEvents, isCacheValid]);

  // Load all data for a community
  const loadCommunityData = useCallback(async (
    communityId: string,
    signal: AbortSignal
  ): Promise<void> => {
    try {
      const [kind, pubkey, identifier] = communityId.split(':');
      if (!kind || !pubkey || !identifier) return;

      // Load channels first if not cached
      const channelsCacheKey = ['channels', communityId];
      if (!isCacheValid(channelsCacheKey, PRIORITY_CACHE_MAX_AGE)) {
        const channelFilters: NostrFilter[] = [{
          kinds: [32807],
          '#a': [communityId],
          '#t': ['channel'],
          limit: 50,
        }];

        const channelEvents = await nostr.query(channelFilters, { signal });

        if (channelEvents.length > 0) {
          cacheEvents(channelEvents);

          // Process and cache channels inline
          const channels = channelEvents
            .filter(event => {
              const d = event.tags.find(([name]) => name === 'd')?.[1];
              return d && event.kind === 32807;
            })
            .map(event => {
              const d = event.tags.find(([name]) => name === 'd')?.[1] || '';
              const name = event.tags.find(([name]) => name === 'name')?.[1] || '';

              let content: { name: string; type: 'text' | 'voice' };
              try {
                content = JSON.parse(event.content);
              } catch {
                content = { name, type: 'text' };
              }

              return {
                id: d,
                name: content.name || name,
                type: content.type || 'text',
                communityId,
                creator: event.pubkey,
                event,
              };
            });

          // Always include general channel
          const hasGeneral = channels.some(ch => ch.name.toLowerCase() === 'general');
          if (!hasGeneral) {
            channels.unshift({
              id: 'general',
              name: 'general',
              type: 'text' as const,
              communityId,
              creator: '',
              event: {} as NostrEvent,
            });
          }

          queryClient.setQueryData(channelsCacheKey, channels, {
            updatedAt: Date.now(),
          });
        }
      }

      // Load spaces if not cached
      const spacesCacheKey = ['spaces', communityId];
      if (!isCacheValid(spacesCacheKey, PRIORITY_CACHE_MAX_AGE)) {
        const spaceFilters: NostrFilter[] = [{
          kinds: [39097],
          '#a': [communityId],
          '#t': ['space'],
          limit: 20,
        }];

        const spaceEvents = await nostr.query(spaceFilters, { signal });

        if (spaceEvents.length > 0) {
          cacheEvents(spaceEvents);

          // Process and cache spaces inline
          const defaultSpaces = [
            {
              id: 'marketplace',
              name: 'Marketplace',
              description: 'Buy and sell goods with Bitcoin, Lightning, and Cashu',
              type: 'marketplace' as const,
              icon: 'ShoppingBag',
              enabled: true,
              position: 0,
              communityId,
              creator: '',
              event: {} as NostrEvent,
            },
            {
              id: 'resources',
              name: 'Resources',
              description: 'Organized collection of useful links and files',
              type: 'resources' as const,
              icon: 'BookOpen',
              enabled: true,
              position: 1,
              communityId,
              creator: '',
              event: {} as NostrEvent,
            },
          ];

          // Process custom space configurations
          const customSpaces = spaceEvents
            .filter(event => {
              const d = event.tags.find(([name]) => name === 'd')?.[1];
              return d && event.kind === 39097;
            })
            .map(event => {
              const d = event.tags.find(([name]) => name === 'd')?.[1] || '';
              const name = event.tags.find(([name]) => name === 'name')?.[1] || '';

              let content: { name?: string; type?: 'marketplace' | 'resources' | 'custom'; icon?: string; enabled?: boolean; position?: number; description?: string };
              try {
                content = JSON.parse(event.content);
              } catch {
                content = { name };
              }

              return {
                id: d,
                name: content.name || name,
                description: content.description || '',
                type: content.type || 'custom' as const,
                icon: content.icon || 'Box',
                enabled: content.enabled !== false,
                position: content.position || 999,
                communityId,
                creator: event.pubkey,
                event,
              };
            });

          // Merge default and custom spaces
          const allSpaces: Array<{
            id: string;
            name: string;
            description: string;
            type: 'marketplace' | 'resources' | 'custom';
            icon: string;
            enabled: boolean;
            position: number;
            communityId: string;
            creator: string;
            event: NostrEvent;
          }> = [...defaultSpaces];

          customSpaces.forEach(custom => {
            const existingIndex = allSpaces.findIndex(s => s.id === custom.id);
            if (existingIndex >= 0) {
              allSpaces[existingIndex] = custom;
            } else {
              allSpaces.push(custom);
            }
          });

          const spaces = allSpaces.filter(space => space.enabled);

          queryClient.setQueryData(spacesCacheKey, spaces, {
            updatedAt: Date.now(),
          });
        }
      }

      // Get channels for this community
      const channels = queryClient.getQueryData<Array<{ id: string; name: string }>>(['channels', communityId]) || [];

      // Always load general channel first
      await loadChannelEvents(communityId, 'general', signal);

      // Load other channels in batches
      const otherChannels = channels.filter(ch => ch.id !== 'general').slice(0, CHANNEL_BATCH_SIZE);

      for (const channel of otherChannels) {
        if (signal.aborted) break;

        await loadChannelEvents(communityId, channel.id, signal);

        // Small delay between channels
        if (otherChannels.indexOf(channel) < otherChannels.length - 1) {
          await new Promise(resolve => setTimeout(resolve, INTER_CHANNEL_DELAY));
        }
      }

      // Mark community as loaded
      stateRef.current.loadedCommunities.set(communityId, Date.now());

    } catch (error) {
      if (!signal.aborted) {
        logger.warn(`Failed to load community data for ${communityId}:`, error);
      }
    }
  }, [nostr, cacheEvents, queryClient, isCacheValid, loadChannelEvents]);

  // Build priority queue of communities to load
  const buildPriorityQueue = useCallback((): LoadingPriority[] => {
    if (!userCommunities) return [];

    const now = Date.now();
    const priorities: LoadingPriority[] = [];

    for (const community of userCommunities) {
      // Skip if recently loaded
      const lastLoaded = stateRef.current.loadedCommunities.get(community.id);
      if (lastLoaded && (now - lastLoaded) < CACHE_MAX_AGE) {
        continue;
      }

      // Calculate priority
      const priority = calculateCommunityPriority(community);

      // Get last visit time
      let lastVisited = 0;
      try {
        const visitHistory = localStorage.getItem('community-visit-history');
        if (visitHistory) {
          const history = JSON.parse(visitHistory);
          lastVisited = history[community.id] || 0;
        }
      } catch {
        // Ignore JSON parse errors
      }

      priorities.push({
        communityId: community.id,
        priority,
        lastVisited,
        membershipStatus: community.membershipStatus,
      });
    }

    // Sort by priority (highest first)
    return priorities.sort((a, b) => b.priority - a.priority);
  }, [userCommunities, calculateCommunityPriority]);

  // Main strategic loading function
  const startStrategicLoading = useCallback(async () => {
    // Don't start if already loading or no user
    if (stateRef.current.isLoading || !user?.pubkey) return;

    // Build priority queue
    const priorityQueue = buildPriorityQueue();
    if (priorityQueue.length === 0) return;

    stateRef.current.isLoading = true;
    stateRef.current.priorityQueue = priorityQueue;

    // Create abort controller for this loading session
    loadingAbortControllerRef.current = new AbortController();
    const signal = loadingAbortControllerRef.current.signal;

    try {
      // Process communities in batches
      while (priorityQueue.length > 0 && !signal.aborted) {
        const batch = priorityQueue.splice(0, BATCH_SIZE);

        // Load communities in parallel within batch
        await Promise.all(
          batch.map(async ({ communityId }) => {
            if (signal.aborted) return;

            stateRef.current.currentLoadingCommunity = communityId;
            await loadCommunityData(communityId, signal);
          })
        );

        // Delay between batches
        if (priorityQueue.length > 0 && !signal.aborted) {
          await new Promise(resolve => setTimeout(resolve, INTER_BATCH_DELAY));
        }
      }
    } catch (error) {
      if (!signal.aborted) {
        logger.warn('Strategic loading error:', error);
      }
    } finally {
      stateRef.current.isLoading = false;
      stateRef.current.currentLoadingCommunity = null;
      loadingAbortControllerRef.current = undefined;
    }
  }, [user?.pubkey, buildPriorityQueue, loadCommunityData]);

  // Update the ref when the function changes
  useEffect(() => {
    startStrategicLoadingRef.current = startStrategicLoading;
  }, [startStrategicLoading]);

  // Monitor query cache activity
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      // Track activity when queries are added or updated
      if (event?.type === 'observerAdded' || event?.type === 'updated') {
        trackActivity();
      }
    });

    return unsubscribe;
  }, [queryClient, trackActivity]);

  // Monitor mutation cache activity
  useEffect(() => {
    const unsubscribe = queryClient.getMutationCache().subscribe(() => {
      // Track activity on any mutation
      trackActivity();
    });

    return unsubscribe;
  }, [queryClient, trackActivity]);

  // Track mouse and keyboard activity
  useEffect(() => {
    const handleActivity = () => trackActivity();

    // Throttle activity tracking
    let lastActivityTime = 0;
    const throttledActivity = () => {
      const now = Date.now();
      if (now - lastActivityTime > 500) {
        lastActivityTime = now;
        handleActivity();
      }
    };

    window.addEventListener('mousemove', throttledActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', throttledActivity);

    // Initial activity tracking
    trackActivity();

    return () => {
      window.removeEventListener('mousemove', throttledActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', throttledActivity);

      // Cleanup timeouts
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }

      // Abort any ongoing loading
      if (loadingAbortControllerRef.current) {
        loadingAbortControllerRef.current.abort();
      }
    };
  }, [trackActivity]);

  // Invalidate old caches periodically
  useEffect(() => {
    const invalidateOldCaches = () => {
      const now = Date.now();
      const queries = queryClient.getQueryCache().getAll();

      queries.forEach(query => {
        const state = query.state;
        if (state.dataUpdatedAt && (now - state.dataUpdatedAt) > CACHE_MAX_AGE * 2) {
          // Invalidate queries older than 2x cache max age
          queryClient.invalidateQueries({ queryKey: query.queryKey });
        }
      });
    };

    // Run every 5 minutes
    const interval = setInterval(invalidateOldCaches, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [queryClient]);

  // Public API
  const getLoadingStatus = useCallback(() => ({
    isLoading: stateRef.current.isLoading,
    currentLoadingCommunity: stateRef.current.currentLoadingCommunity,
    loadedCommunities: stateRef.current.loadedCommunities.size,
    loadedChannels: stateRef.current.loadedChannels.size,
    queueLength: stateRef.current.priorityQueue.length,
  }), []);

  const forceLoadCommunity = useCallback(async (communityId: string) => {
    // Abort any ongoing background loading
    if (loadingAbortControllerRef.current) {
      loadingAbortControllerRef.current.abort();
    }

    // Create new abort controller
    const abortController = new AbortController();

    try {
      await loadCommunityData(communityId, abortController.signal);
    } catch (error) {
      logger.warn(`Failed to force load community ${communityId}:`, error);
    }
  }, [loadCommunityData]);

  const clearCache = useCallback((communityId?: string) => {
    if (communityId) {
      // Clear specific community
      stateRef.current.loadedCommunities.delete(communityId);

      // Clear all channels for this community
      const channelKeys = Array.from(stateRef.current.loadedChannels.keys());
      channelKeys.forEach(key => {
        if (key.startsWith(`${communityId}:`)) {
          stateRef.current.loadedChannels.delete(key);
        }
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['messages', communityId] });
      queryClient.invalidateQueries({ queryKey: ['channels', communityId] });
      queryClient.invalidateQueries({ queryKey: ['spaces', communityId] });
    } else {
      // Clear all
      stateRef.current.loadedCommunities.clear();
      stateRef.current.loadedChannels.clear();
    }
  }, [queryClient]);

  return {
    getLoadingStatus,
    forceLoadCommunity,
    clearCache,
  };
}

/**
 * Hook to enable strategic background loading without exposing controls
 */
export function useEnableStrategicBackgroundLoading() {
  useStrategicBackgroundLoader();
}