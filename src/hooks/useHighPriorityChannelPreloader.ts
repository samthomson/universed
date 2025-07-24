import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useEventCache } from './useEventCache';
import { useUserCommunities } from './useUserCommunities';
import { useCurrentUser } from './useCurrentUser';
import type { NostrFilter, NostrEvent } from '@nostrify/nostrify';
import type { Channel } from './useChannels';

/**
 * High-priority channel preloader that runs immediately when user communities are available.
 * This ensures channels are cached before users even think about clicking on communities.
 */
export function useHighPriorityChannelPreloader() {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { cacheEvents } = useEventCache();
  const { data: userCommunities } = useUserCommunities();
  const { user } = useCurrentUser();

  const hasPreloadedRef = useRef(false);
  const isPreloadingRef = useRef(false);

  // Validate channel event
  const validateChannelEvent = useCallback((event: NostrEvent): boolean => {
    if (event.kind !== 32807) return false;
    const d = event.tags.find(([name]) => name === 'd')?.[1];
    const communityRef = event.tags.find(([name]) => name === 'a')?.[1];
    if (!d || !communityRef) return false;
    try {
      const content = JSON.parse(event.content);
      if (!content.name || !['text', 'voice'].includes(content.type)) {
        return false;
      }
    } catch {
      return false;
    }
    return true;
  }, []);

  // Parse channel event into Channel object
  const parseChannelEvent = useCallback((event: NostrEvent, communityId: string): Channel => {
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
  }, []);

  // High-priority preload function
  const preloadChannelsHighPriority = useCallback(async (communityIds: string[]) => {
    if (isPreloadingRef.current || communityIds.length === 0) return;

    isPreloadingRef.current = true;
    console.log('🚀 HIGH PRIORITY: Preloading channels for', communityIds.length, 'communities');

    try {
      // Create aggressive filters for immediate channel loading
      const filters: NostrFilter[] = communityIds.map(communityId => ({
        kinds: [32807],
        '#a': [communityId],
        '#t': ['channel'],
        limit: 30, // Smaller limit for speed
      }));

      // Use very short timeout for high priority - we want this to be fast
      const signal = AbortSignal.timeout(2000);
      const events = await nostr.query(filters, { signal });

      if (events.length > 0) {
        // Cache events immediately
        cacheEvents(events);

        // Process and cache channels for each community
        const communitiesProcessed = new Set<string>();

        for (const event of events) {
          const communityRef = event.tags.find(([name]) => name === 'a')?.[1];
          if (!communityRef || communitiesProcessed.has(communityRef)) continue;

          if (validateChannelEvent(event)) {
            communitiesProcessed.add(communityRef);

            // Get all events for this community
            const communityEvents = events.filter(e => {
              const ref = e.tags.find(([name]) => name === 'a')?.[1];
              return ref === communityRef && validateChannelEvent(e);
            });

            const customChannels = communityEvents.map(e => parseChannelEvent(e, communityRef));

            // Always include the default "general" channel
            const allChannels = [
              {
                id: 'general',
                name: 'general',
                description: 'General discussion',
                type: 'text' as const,
                communityId: communityRef,
                creator: '',
                position: 0,
                event: {} as NostrEvent,
              },
              ...customChannels.filter(ch => ch.name.toLowerCase() !== 'general')
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

            // Cache channels immediately with high priority
            queryClient.setQueryData(
              ['channels', communityRef],
              sortedChannels,
              {
                updatedAt: Date.now(),
              }
            );
          }
        }

        console.log(`✅ HIGH PRIORITY: Cached channels for ${communitiesProcessed.size} communities (${events.length} events)`);
      }
    } catch (error) {
      console.warn('High priority channel preload failed:', error);
    } finally {
      isPreloadingRef.current = false;
    }
  }, [nostr, cacheEvents, queryClient, validateChannelEvent, parseChannelEvent]);

  // Run high-priority preload immediately when user communities are available
  useEffect(() => {
    if (!user?.pubkey || !userCommunities || userCommunities.length === 0) {
      return;
    }

    // Don't preload multiple times
    if (hasPreloadedRef.current) {
      return;
    }

    hasPreloadedRef.current = true;

    // Get community IDs prioritized by membership status
    const communityIds = userCommunities
      .sort((a, b) => {
        const statusOrder = { owner: 0, moderator: 1, approved: 2 };
        return statusOrder[a.membershipStatus] - statusOrder[b.membershipStatus];
      })
      .map(community => community.id);

    // Start high-priority preload immediately (no delay)
    preloadChannelsHighPriority(communityIds);
  }, [user?.pubkey, userCommunities, preloadChannelsHighPriority]);

  // Reset when user changes
  useEffect(() => {
    hasPreloadedRef.current = false;
    isPreloadingRef.current = false;
  }, [user?.pubkey]);
}