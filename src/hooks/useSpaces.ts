import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';
import { useCanModerate } from './useCommunityRoles';
import { useEventCache } from './useEventCache';
import { logger } from '@/lib/logger';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';

export interface Space {
  id: string;
  name: string;
  description?: string;
  type: 'marketplace' | 'resources' | 'custom';
  icon: string;
  enabled: boolean;
  communityId: string;
  creator: string;
  position: number;
  event?: NostrEvent;
}

interface SpaceContent {
  name: string;
  description?: string;
  type: 'marketplace' | 'resources' | 'custom';
  icon: string;
  enabled: boolean;
  position: number;
}

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

function validateSpaceEvent(event: NostrEvent): boolean {
  if (event.kind !== 39097) return false; // Custom kind for community spaces

  const d = event.tags.find(([name]) => name === 'd')?.[1];
  const communityRef = event.tags.find(([name]) => name === 'a')?.[1];

  if (!d || !communityRef) return false;

  try {
    const content = JSON.parse(event.content) as SpaceContent;
    if (!content.name || !['marketplace', 'resources', 'custom'].includes(content.type)) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

function parseSpaceEvent(event: NostrEvent, communityId: string): Space {
  const d = event.tags.find(([name]) => name === 'd')?.[1] || '';
  const name = event.tags.find(([name]) => name === 'name')?.[1] || '';
  const description = event.tags.find(([name]) => name === 'description')?.[1];
  const spaceType = event.tags.find(([name]) => name === 'space_type')?.[1] as 'marketplace' | 'resources' | 'custom' || 'custom';
  const icon = event.tags.find(([name]) => name === 'icon')?.[1] || 'Box';
  const enabled = event.tags.find(([name]) => name === 'enabled')?.[1] !== 'false';
  const position = parseInt(event.tags.find(([name]) => name === 'position')?.[1] || '999');

  let content: SpaceContent;
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
}

export function useSpaces(communityId: string | null) {
  const { nostr } = useNostr();
  const { getCachedEventsByKind, cacheEvents } = useEventCache();

  return useQuery({
    queryKey: ['spaces', communityId],
    queryFn: async (c) => {
      if (!communityId) return [];

      // PRIORITY 1: Check for cached space events first and return immediately if found
      const cachedSpaceEvents = getCachedEventsByKind(39097).filter(event => {
        const communityRef = event.tags.find(([name]) => name === 'a')?.[1];
        return communityRef === communityId && validateSpaceEvent(event);
      });

      // Process cached events and return immediately if available
      const processSpaces = (events: NostrEvent[]) => {
        const validEvents = events.filter(validateSpaceEvent);
        const customSpaces = validEvents.map(event => parseSpaceEvent(event, communityId));

        // Start with default spaces
        const defaultSpaces: Space[] = DEFAULT_SPACES.map(space => ({
          ...space,
          communityId,
          creator: '',
          event: undefined,
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

        // Sort by position, then alphabetically
        return allSpaces
          .filter(space => space.enabled) // Only return enabled spaces
          .sort((a, b) => {
            if (a.position !== b.position) {
              return a.position - b.position;
            }
            return a.name.localeCompare(b.name);
          });
      };

      // If we have cached events, process them immediately and return
      if (cachedSpaceEvents.length > 0) {
        const cachedSpaces = processSpaces(cachedSpaceEvents);

        // Start background refresh but return cached data immediately
        setTimeout(() => {
          refreshSpacesInBackground(communityId, nostr, cacheEvents);
        }, 100);

        return cachedSpaces;
      }

      // PRIORITY 2: No cached data, fetch with short timeout for immediate response
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1000)]); // Reduced to 1 second

      try {
        // Query for space configuration events
        const events = await nostr.query([
          {
            kinds: [39097], // Community space configuration events
            '#a': [communityId], // Filter by community
            '#t': ['space'], // Filter by space tag
            limit: 30, // Reduced limit for faster response
          }
        ], { signal });

        // Cache the fetched events immediately
        if (events.length > 0) {
          cacheEvents(events);
        }

        return processSpaces(events);
      } catch (error) {
        logger.warn('Failed to fetch spaces quickly, returning defaults:', error);

        // PRIORITY 3: On error or timeout, return default spaces immediately
        const defaultSpaces: Space[] = DEFAULT_SPACES.map(space => ({
          ...space,
          communityId: communityId || '',
          creator: '',
          event: undefined,
        }));

        // Start background refresh for next time
        setTimeout(() => {
          refreshSpacesInBackground(communityId, nostr, cacheEvents);
        }, 1000);

        return defaultSpaces;
      }
    },
    enabled: !!communityId,
    staleTime: 1000 * 60 * 15, // 15 minutes - very long cache since spaces change less frequently
    gcTime: 1000 * 60 * 60, // 1 hour - keep in memory very long
    refetchOnMount: false, // Don't refetch on mount, use cached data
    refetchOnWindowFocus: false, // Don't refetch on focus, use cached data
    refetchOnReconnect: false, // Don't refetch on reconnect, use cached data
  });
}

// Background refresh function that doesn't block the UI
async function refreshSpacesInBackground(
  communityId: string,
  nostr: { query: (filters: NostrFilter[], options: { signal: AbortSignal }) => Promise<NostrEvent[]> },
  cacheEvents: (events: NostrEvent[]) => void
) {
  try {
    const signal = AbortSignal.timeout(8000); // Longer timeout for background refresh
    const events = await nostr.query([
      {
        kinds: [39097],
        '#a': [communityId],
        '#t': ['space'],
        limit: 50,
      }
    ], { signal });

    if (events.length > 0) {
      cacheEvents(events);
      logger.log(`Background refreshed ${events.length} space events for ${communityId}`);
    }
  } catch (error) {
    logger.warn('Background space refresh failed:', error);
  }
}

export function useUpdateSpace(communityId: string) {
  const { mutateAsync: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const { canModerate } = useCanModerate(communityId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      spaceId,
      name,
      description,
      type,
      icon,
      enabled,
      position,
    }: {
      spaceId: string;
      name: string;
      description?: string;
      type: 'marketplace' | 'resources' | 'custom';
      icon: string;
      enabled: boolean;
      position: number;
    }) => {
      if (!user || !canModerate) {
        throw new Error('Only moderators and admins can update spaces');
      }

      const tags = [
        ['d', `${communityId}:${spaceId}`],
        ['a', communityId],
        ['name', name],
        ['description', description || ''],
        ['space_type', type],
        ['icon', icon],
        ['enabled', enabled.toString()],
        ['position', position.toString()],
        ['t', 'space'],
        ['alt', `Space: ${name}`],
      ];

      await createEvent({
        kind: 39097,
        content: JSON.stringify({
          name,
          description,
          type,
          icon,
          enabled,
          position,
        }),
        tags,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', communityId] });
    },
  });
}

export function useDeleteSpace(communityId: string) {
  const { mutateAsync: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const { canModerate } = useCanModerate(communityId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ spaceEventId, spaceName }: { spaceEventId: string; spaceName: string }) => {
      if (!user || !canModerate) {
        throw new Error('Only moderators and admins can delete spaces');
      }

      // Prevent deletion of default spaces, only allow disabling them
      if (['marketplace', 'resources'].includes(spaceName.toLowerCase())) {
        throw new Error('Cannot delete default spaces. Use disable instead.');
      }

      await createEvent({
        kind: 5, // Deletion event
        content: `Space "${spaceName}" deleted`,
        tags: [
          ['e', spaceEventId],
          ['k', '39097'],
          ['alt', `Delete space: ${spaceName}`],
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', communityId] });
    },
  });
}

// Hook to get all spaces including disabled ones (for admin management)
export function useAllSpaces(communityId: string | null) {
  const { nostr } = useNostr();
  const { getCachedEventsByKind } = useEventCache();

  return useQuery({
    queryKey: ['all-spaces', communityId],
    queryFn: async (c) => {
      if (!communityId) return [];

      // Check cache first for admin management
      const cachedSpaceEvents = getCachedEventsByKind(39097).filter(event => {
        const communityRef = event.tags.find(([name]) => name === 'a')?.[1];
        return communityRef === communityId && validateSpaceEvent(event);
      });

      const processAllSpaces = (events: NostrEvent[]) => {
        const validEvents = events.filter(validateSpaceEvent);
        const customSpaces = validEvents.map(event => parseSpaceEvent(event, communityId));

        // Start with default spaces
        const defaultSpaces: Space[] = DEFAULT_SPACES.map(space => ({
          ...space,
          communityId,
          creator: '',
          event: undefined,
        }));

        const allSpaces = [...defaultSpaces];

        // Apply custom configurations or add new custom spaces
        customSpaces.forEach(customSpace => {
          const existingIndex = allSpaces.findIndex(existing => existing.id === customSpace.id);
          if (existingIndex >= 0) {
            allSpaces[existingIndex] = customSpace;
          } else {
            allSpaces.push(customSpace);
          }
        });

        return allSpaces.sort((a, b) => {
          if (a.position !== b.position) {
            return a.position - b.position;
          }
          return a.name.localeCompare(b.name);
        });
      };

      // Return cached data if available
      if (cachedSpaceEvents.length > 0) {
        return processAllSpaces(cachedSpaceEvents);
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(2000)]);

      try {
        const events = await nostr.query([
          {
            kinds: [39097],
            '#a': [communityId],
            '#t': ['space'],
            limit: 50,
          }
        ], { signal });

        return processAllSpaces(events);
      } catch {
        return DEFAULT_SPACES.map(space => ({
          ...space,
          communityId: communityId || '',
          creator: '',
          event: undefined,
        }));
      }
    },
    enabled: !!communityId,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}