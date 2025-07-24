import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useEventCache } from './useEventCache';
import { useUserCommunities } from './useUserCommunities';
import { useCurrentUser } from './useCurrentUser';
import type { NostrFilter, NostrEvent } from '@nostrify/nostrify';

interface BackgroundLoadingState {
  isLoading: boolean;
  lastLoadTime: number;
  loadedCommunities: Set<string>;
  loadQueue: string[];
  currentBatch: string[];
}

const BACKGROUND_LOAD_DELAY = 2000; // Wait 2 seconds after other activity stops
const BATCH_SIZE = 3; // Load events for 3 communities at once
const LOAD_COOLDOWN = 30000; // Wait 30 seconds between background loads for same community
const MAX_EVENTS_PER_COMMUNITY = 50; // Limit events per community to avoid overwhelming

/**
 * Hook that manages background loading of community events when the app is idle.
 * This improves perceived performance by preloading content users are likely to access.
 */
export function useBackgroundLoader() {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { cacheEvents } = useEventCache();
  const { data: userCommunities } = useUserCommunities();
  const { user } = useCurrentUser();

  const stateRef = useRef<BackgroundLoadingState>({
    isLoading: false,
    lastLoadTime: 0,
    loadedCommunities: new Set(),
    loadQueue: [],
    currentBatch: [],
  });

  const timeoutRef = useRef<NodeJS.Timeout>();
  const activityTimeoutRef = useRef<NodeJS.Timeout>();
  const startBackgroundLoadingRef = useRef<(() => Promise<void>) | null>(null);



  // Track query activity to determine when to start background loading
  const trackQueryActivity = useCallback(() => {
    // Clear existing timeout
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    // Set new timeout to start background loading after inactivity
    activityTimeoutRef.current = setTimeout(() => {
      // Use the ref to avoid dependency issues
      const loadingFn = startBackgroundLoadingRef.current;
      if (loadingFn) {
        loadingFn();
      }
    }, BACKGROUND_LOAD_DELAY);
  }, []);

  // Check if we should skip loading for a community (recently loaded)
  const shouldSkipCommunity = useCallback((communityId: string): boolean => {
    const now = Date.now();
    const lastLoaded = stateRef.current.loadedCommunities.has(communityId);

    if (!lastLoaded) return false;

    // Check if we have recent data in cache
    const cacheKey = ['messages', communityId, 'general'];
    const cachedData = queryClient.getQueryData(cacheKey);
    const queryState = queryClient.getQueryState(cacheKey);

    // Skip if we have fresh data (less than 5 minutes old)
    if (cachedData && queryState?.dataUpdatedAt && (now - queryState.dataUpdatedAt) < 5 * 60 * 1000) {
      return true;
    }

    return false;
  }, [queryClient]);

  // Prepare the loading queue based on user communities
  const prepareLoadQueue = useCallback((): string[] => {
    if (!userCommunities || userCommunities.length === 0) {
      return [];
    }

    // Filter out communities that should be skipped
    const communitiesToLoad = userCommunities
      .filter(community => !shouldSkipCommunity(community.id))
      .map(community => community.id);

    // Prioritize communities by membership status (owners/moderators first)
    const prioritized = communitiesToLoad.sort((a, b) => {
      const communityA = userCommunities.find(c => c.id === a);
      const communityB = userCommunities.find(c => c.id === b);

      if (!communityA || !communityB) return 0;

      const statusOrder = { owner: 0, moderator: 1, approved: 2 };
      return statusOrder[communityA.membershipStatus] - statusOrder[communityB.membershipStatus];
    });

    return prioritized;
  }, [userCommunities, shouldSkipCommunity]);

  // Load events for a batch of communities
  const loadCommunityEventsBatch = useCallback(async (communityIds: string[]): Promise<void> => {
    if (!user?.pubkey || communityIds.length === 0) return;

    try {
      // Create batched filters for efficient querying
      const filters: NostrFilter[] = [];

      for (const communityId of communityIds) {
        const [kind, pubkey, identifier] = communityId.split(':');
        if (!kind || !pubkey || !identifier) continue;

        // Load recent messages for general channel
        filters.push({
          kinds: [1, 9411], // Messages
          '#a': [`${kind}:${pubkey}:${identifier}`],
          limit: Math.floor(MAX_EVENTS_PER_COMMUNITY / 3), // Split limit between message types
        });

        // Load recent reactions and comments
        filters.push({
          kinds: [7, 1111], // Reactions and comments
          '#a': [`${kind}:${pubkey}:${identifier}`],
          limit: Math.floor(MAX_EVENTS_PER_COMMUNITY / 3),
        });

        // Load channel definitions (NEW)
        filters.push({
          kinds: [32807], // Channel definition events
          '#a': [`${kind}:${pubkey}:${identifier}`],
          '#t': ['channel'],
          limit: Math.floor(MAX_EVENTS_PER_COMMUNITY / 4),
        });

        // Load space configurations (NEW)
        filters.push({
          kinds: [39097], // Space configuration events
          '#a': [`${kind}:${pubkey}:${identifier}`],
          '#t': ['space'],
          limit: Math.floor(MAX_EVENTS_PER_COMMUNITY / 4),
        });
      }

      if (filters.length === 0) return;

      // Execute batched query with timeout
      const signal = AbortSignal.timeout(8000); // 8 second timeout for background loading
      const events = await nostr.query(filters, { signal });

      if (events.length > 0) {
        // Cache the events
        cacheEvents(events);

        // Update query cache for each community
        for (const communityId of communityIds) {
          const communityEvents = events.filter(event => {
            const communityRef = event.tags.find(([name]) => name === 'a')?.[1];
            return communityRef === communityId.replace(':', ':');
          });

          if (communityEvents.length > 0) {
            // Cache messages for general channel
            const messageEvents = communityEvents
              .filter(event => [1, 9411].includes(event.kind))
              .sort((a, b) => a.created_at - b.created_at);

            if (messageEvents.length > 0) {
              queryClient.setQueryData(
                ['messages', communityId, 'general'],
                messageEvents,
                {
                  updatedAt: Date.now(),
                }
              );
            }

            // Cache reactions
            const reactionEvents = communityEvents.filter(event => event.kind === 7);
            if (reactionEvents.length > 0) {
              queryClient.setQueryData(
                ['reactions', communityId],
                reactionEvents,
                {
                  updatedAt: Date.now(),
                }
              );
            }

            // Cache channels (NEW)
            const channelEvents = communityEvents.filter(event => event.kind === 32807);
            if (channelEvents.length > 0) {
              // Process channel events into Channel objects
              const channels = channelEvents
                .filter(event => {
                  // Basic validation
                  const d = event.tags.find(([name]) => name === 'd')?.[1];
                  const communityRef = event.tags.find(([name]) => name === 'a')?.[1];
                  return d && communityRef;
                })
                .map(event => {
                  const d = event.tags.find(([name]) => name === 'd')?.[1] || '';
                  const name = event.tags.find(([name]) => name === 'name')?.[1] || '';
                  const description = event.tags.find(([name]) => name === 'description')?.[1];
                  const channelType = event.tags.find(([name]) => name === 'channel_type')?.[1] as 'text' | 'voice' || 'text';
                  const folderId = event.tags.find(([name]) => name === 'folder')?.[1];
                  const position = parseInt(event.tags.find(([name]) => name === 'position')?.[1] || '0');

                  let content: { name: string; type: 'text' | 'voice'; folderId?: string; position?: number; description?: string };
                  try {
                    content = JSON.parse(event.content);
                  } catch {
                    content = { name, type: channelType };
                  }

                  return {
                    id: d || `${communityId}:${name}`,
                    name: content.name || name,
                    description: content.description || description,
                    type: content.type || channelType,
                    communityId,
                    creator: event.pubkey,
                    folderId: content.folderId || folderId,
                    position: content.position || position,
                    event,
                  };
                });

              // Always include the default "general" channel
              const allChannels = [
                {
                  id: 'general',
                  name: 'general',
                  description: 'General discussion',
                  type: 'text' as const,
                  communityId,
                  creator: '',
                  folderId: undefined,
                  position: 0,
                  event: {} as NostrEvent,
                },
                ...channels.filter(ch => ch.name.toLowerCase() !== 'general')
              ];

              // Sort channels
              const sortedChannels = allChannels.sort((a, b) => {
                if (a.folderId !== b.folderId) {
                  if (!a.folderId) return -1;
                  if (!b.folderId) return 1;
                  return a.folderId.localeCompare(b.folderId);
                }
                if (a.position !== b.position) {
                  return a.position - b.position;
                }
                if (a.type !== b.type) {
                  return a.type === 'text' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
              });

              queryClient.setQueryData(
                ['channels', communityId],
                sortedChannels,
                {
                  updatedAt: Date.now(),
                }
              );
            }

            // Cache spaces (NEW)
            const spaceEvents = communityEvents.filter(event => event.kind === 39097);

            // Default spaces that come with every community
            const defaultSpaces: Array<{ id: string; name: string; description: string; type: 'marketplace' | 'resources' | 'custom'; icon: string; enabled: boolean; position: number; communityId: string; creator: string; event: NostrEvent }> = [
              {
                id: 'marketplace',
                name: 'Marketplace',
                description: 'Buy and sell goods with Bitcoin, Lightning, and Cashu',
                type: 'marketplace',
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
                type: 'resources',
                icon: 'BookOpen',
                enabled: true,
                position: 1,
                communityId,
                creator: '',
                event: {} as NostrEvent,
              },
            ];

            if (spaceEvents.length > 0) {
              // Process space events
              const customSpaces = spaceEvents
                .filter(event => {
                  // Basic validation
                  const d = event.tags.find(([name]) => name === 'd')?.[1];
                  const communityRef = event.tags.find(([name]) => name === 'a')?.[1];
                  return d && communityRef;
                })
                .map(event => {
                  const d = event.tags.find(([name]) => name === 'd')?.[1] || '';
                  const name = event.tags.find(([name]) => name === 'name')?.[1] || '';
                  const description = event.tags.find(([name]) => name === 'description')?.[1];
                  const spaceType = event.tags.find(([name]) => name === 'space_type')?.[1] as 'marketplace' | 'resources' | 'custom' || 'custom';
                  const icon = event.tags.find(([name]) => name === 'icon')?.[1] || 'Box';
                  const enabled = event.tags.find(([name]) => name === 'enabled')?.[1] !== 'false';
                  const position = parseInt(event.tags.find(([name]) => name === 'position')?.[1] || '999');

                  let content: { name: string; type: 'marketplace' | 'resources' | 'custom'; icon: string; enabled: boolean; position: number; description?: string };
                  try {
                    content = JSON.parse(event.content);
                  } catch {
                    content = { name, type: spaceType, icon, enabled, position };
                  }

                  return {
                    id: d || `${communityId}:${name}`,
                    name: content.name || name,
                    description: content.description || description || '',
                    type: content.type || spaceType,
                    icon: content.icon || icon,
                    enabled: content.enabled !== undefined ? content.enabled : enabled,
                    communityId,
                    creator: event.pubkey,
                    position: content.position || position,
                    event,
                  } as { id: string; name: string; description: string; type: 'marketplace' | 'resources' | 'custom'; icon: string; enabled: boolean; communityId: string; creator: string; position: number; event: NostrEvent };
                });

              // Merge with custom configurations
              const allSpaces = [...defaultSpaces];

              // Apply custom configurations or add new custom spaces
              customSpaces.forEach(customSpace => {
                const existingIndex = allSpaces.findIndex(existing => existing.id === customSpace.id);
                if (existingIndex >= 0) {
                  // Update existing space configuration
                  allSpaces[existingIndex] = customSpace;
                } else {
                  // Add new custom space
                  allSpaces.push(customSpace);
                }
              });

              // Sort spaces
              const sortedSpaces = allSpaces.sort((a, b) => {
                if (a.position !== b.position) {
                  return a.position - b.position;
                }
                return a.name.localeCompare(b.name);
              });

              // Cache enabled spaces
              const enabledSpaces = sortedSpaces.filter(space => space.enabled);
              queryClient.setQueryData(
                ['spaces', communityId],
                enabledSpaces,
                {
                  updatedAt: Date.now(),
                }
              );

              // Cache all spaces (including disabled)
              queryClient.setQueryData(
                ['all-spaces', communityId],
                sortedSpaces,
                {
                  updatedAt: Date.now(),
                }
              );
            } else {
              // No custom space events, cache default spaces
              queryClient.setQueryData(
                ['spaces', communityId],
                defaultSpaces,
                {
                  updatedAt: Date.now(),
                }
              );

              queryClient.setQueryData(
                ['all-spaces', communityId],
                defaultSpaces,
                {
                  updatedAt: Date.now(),
                }
              );
            }

            // Mark community as loaded
            stateRef.current.loadedCommunities.add(communityId);
          }
        }

        console.log(`Background loaded events for ${communityIds.length} communities: ${events.length} events`);
      }
    } catch (error) {
      // Silently handle errors in background loading
      console.warn('Background loading failed:', error);
    }
  }, [user?.pubkey, nostr, cacheEvents, queryClient]);

  // Main background loading function
  const startBackgroundLoading = useCallback(async () => {
    const state = stateRef.current;

    // Prevent concurrent background loading
    if (state.isLoading) return;

    // Check if enough time has passed since last load
    const now = Date.now();
    if (now - state.lastLoadTime < LOAD_COOLDOWN) return;

    // Prepare the loading queue
    const queue = prepareLoadQueue();
    if (queue.length === 0) return;

    state.isLoading = true;
    state.lastLoadTime = now;
    state.loadQueue = queue;

    try {
      // Process queue in batches
      while (state.loadQueue.length > 0 && state.isLoading) {
        const batch = state.loadQueue.splice(0, BATCH_SIZE);
        state.currentBatch = batch;

        await loadCommunityEventsBatch(batch);

        // Small delay between batches to avoid overwhelming the relay
        if (state.loadQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } finally {
      state.isLoading = false;
      state.currentBatch = [];
    }
  }, [prepareLoadQueue, loadCommunityEventsBatch]);

  // Update the ref when the function changes
  useEffect(() => {
    startBackgroundLoadingRef.current = startBackgroundLoading;
  }, [startBackgroundLoading]);

  // Monitor query cache for activity
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      // Track when queries start (indicating user activity)
      if (event?.type === 'observerAdded' || event?.type === 'updated') {
        trackQueryActivity();
      }
    });

    return unsubscribe;
  }, [queryClient, trackQueryActivity]);

  // Start initial background loading when user communities are available
  useEffect(() => {
    if (userCommunities && userCommunities.length > 0 && user?.pubkey) {
      // Delay initial background loading to let the app settle
      timeoutRef.current = setTimeout(() => {
        startBackgroundLoading();
      }, BACKGROUND_LOAD_DELAY * 2); // Double delay for initial load
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [userCommunities, user?.pubkey, startBackgroundLoading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, []);

  // Public API for manual control
  const triggerBackgroundLoad = useCallback(() => {
    startBackgroundLoading();
  }, [startBackgroundLoading]);

  const getLoadingState = useCallback(() => {
    return {
      isLoading: stateRef.current.isLoading,
      loadedCount: stateRef.current.loadedCommunities.size,
      queueLength: stateRef.current.loadQueue.length,
      currentBatch: [...stateRef.current.currentBatch],
    };
  }, []);

  const clearLoadedCache = useCallback(() => {
    stateRef.current.loadedCommunities.clear();
  }, []);

  return {
    triggerBackgroundLoad,
    getLoadingState,
    clearLoadedCache,
  };
}

/**
 * Lightweight hook that just enables background loading without exposing controls.
 * Use this in components that should trigger background loading but don't need to control it.
 */
export function useEnableBackgroundLoading() {
  useBackgroundLoader();
}