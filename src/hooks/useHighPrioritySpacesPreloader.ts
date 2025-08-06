import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useEventCache } from './useEventCache';
import { useUserCommunities } from './useUserCommunities';
import { useCurrentUser } from './useCurrentUser';
import { logger } from '@/lib/logger';
import type { NostrFilter, NostrEvent } from '@nostrify/nostrify';
import type { Space } from './useSpaces';

// Default spaces that come with every community
const DEFAULT_SPACES: Omit<Space, 'communityId' | 'creator' | 'event'>[] = [
  {
    id: 'marketplace',
    name: 'Marketplace',
    description: 'Buy and sell goods with Bitcoin, Lightning, and Cashu',
    type: 'marketplace',
    icon: 'ShoppingBag',
    enabled: true,
    position: 0,
  },
  {
    id: 'resources',
    name: 'Resources',
    description: 'Organized collection of useful links and files',
    type: 'resources',
    icon: 'BookOpen',
    enabled: true,
    position: 1,
  },
];

/**
 * High-priority spaces preloader that runs immediately when user communities are available.
 * This ensures spaces are cached before users even think about clicking on communities.
 */
export function useHighPrioritySpacesPreloader() {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { cacheEvents } = useEventCache();
  const { data: userCommunities } = useUserCommunities();
  const { user } = useCurrentUser();
  
  const hasPreloadedRef = useRef(false);
  const isPreloadingRef = useRef(false);

  // Validate space event
  const validateSpaceEvent = useCallback((event: NostrEvent): boolean => {
    if (event.kind !== 39097) return false;
    const d = event.tags.find(([name]) => name === 'd')?.[1];
    const communityRef = event.tags.find(([name]) => name === 'a')?.[1];
    if (!d || !communityRef) return false;
    try {
      const content = JSON.parse(event.content);
      if (!content.name || !['marketplace', 'resources', 'custom'].includes(content.type)) {
        return false;
      }
    } catch {
      return false;
    }
    return true;
  }, []);

  // Parse space event into Space object
  const parseSpaceEvent = useCallback((event: NostrEvent, communityId: string): Space => {
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
      content = {
        name,
        type: spaceType,
        icon,
        enabled,
        position
      };
    }

    return {
      id: d || `${communityId}:${name}`,
      name: content.name || name,
      description: content.description || description,
      type: content.type || spaceType,
      icon: content.icon || icon,
      enabled: content.enabled !== undefined ? content.enabled : enabled,
      communityId,
      creator: event.pubkey,
      position: content.position || position,
      event,
    };
  }, []);

  // High-priority preload function
  const preloadSpacesHighPriority = useCallback(async (communityIds: string[]) => {
    if (isPreloadingRef.current || communityIds.length === 0) return;
    
    isPreloadingRef.current = true;
    logger.log('🚀 HIGH PRIORITY: Preloading spaces for', communityIds.length, 'communities');

    try {
      // Create aggressive filters for immediate space loading
      const filters: NostrFilter[] = communityIds.map(communityId => ({
        kinds: [39097],
        '#a': [communityId],
        '#t': ['space'],
        limit: 20, // Smaller limit for speed - spaces are typically few
      }));

      // Use very short timeout for high priority - we want this to be fast
      const signal = AbortSignal.timeout(1500);
      const events = await nostr.query(filters, { signal });

      if (events.length > 0) {
        // Cache events immediately
        cacheEvents(events);

        // Process and cache spaces for each community
        const communitiesProcessed = new Set<string>();
        
        for (const communityId of communityIds) {
          if (communitiesProcessed.has(communityId)) continue;
          communitiesProcessed.add(communityId);

          // Get all events for this community
          const communityEvents = events.filter(e => {
            const ref = e.tags.find(([name]) => name === 'a')?.[1];
            return ref === communityId && validateSpaceEvent(e);
          });

          const customSpaces = communityEvents.map(e => parseSpaceEvent(e, communityId));

          // Start with default spaces
          const defaultSpaces: Space[] = DEFAULT_SPACES.map(space => ({
            ...space,
            communityId,
            creator: '',
            event: {} as NostrEvent,
          }));

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

          // Sort and filter enabled spaces
          const sortedSpaces = allSpaces
            .filter(space => space.enabled) // Only return enabled spaces
            .sort((a, b) => {
              if (a.position !== b.position) {
                return a.position - b.position;
              }
              return a.name.localeCompare(b.name);
            });

          // Cache spaces immediately with high priority
          queryClient.setQueryData(
            ['spaces', communityId],
            sortedSpaces,
            {
              updatedAt: Date.now(),
            }
          );

          // Also cache all spaces (including disabled) for admin management
          const allSortedSpaces = allSpaces.sort((a, b) => {
            if (a.position !== b.position) {
              return a.position - b.position;
            }
            return a.name.localeCompare(b.name);
          });

          queryClient.setQueryData(
            ['all-spaces', communityId],
            allSortedSpaces,
            {
              updatedAt: Date.now(),
            }
          );
        }

        logger.log(`✅ HIGH PRIORITY: Cached spaces for ${communitiesProcessed.size} communities (${events.length} events)`);
      } else {
        // No custom space events found, cache default spaces for all communities
        for (const communityId of communityIds) {
          const defaultSpaces: Space[] = DEFAULT_SPACES.map(space => ({
            ...space,
            communityId,
            creator: '',
            event: {} as NostrEvent,
          }));

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

        logger.log(`✅ HIGH PRIORITY: Cached default spaces for ${communityIds.length} communities`);
      }
    } catch (error) {
      logger.warn('High priority spaces preload failed:', error);
      
      // On error, still cache default spaces
      for (const communityId of communityIds) {
        const defaultSpaces: Space[] = DEFAULT_SPACES.map(space => ({
          ...space,
          communityId,
          creator: '',
          event: {} as NostrEvent,
        }));

        queryClient.setQueryData(
          ['spaces', communityId],
          defaultSpaces,
          {
            updatedAt: Date.now(),
          }
        );
      }
    } finally {
      isPreloadingRef.current = false;
    }
  }, [nostr, cacheEvents, queryClient, validateSpaceEvent, parseSpaceEvent]);

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
    preloadSpacesHighPriority(communityIds);
  }, [user?.pubkey, userCommunities, preloadSpacesHighPriority]);

  // Reset when user changes
  useEffect(() => {
    hasPreloadedRef.current = false;
    isPreloadingRef.current = false;
  }, [user?.pubkey]);
}