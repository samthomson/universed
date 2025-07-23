import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';
import { useCanModerate } from './useCommunityRoles';
import type { NostrEvent } from '@nostrify/nostrify';

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

  return useQuery({
    queryKey: ['spaces', communityId],
    queryFn: async (c) => {
      if (!communityId) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      try {
        // Query for space configuration events
        const events = await nostr.query([
          {
            kinds: [39097], // Community space configuration events
            '#a': [communityId], // Filter by community
            '#t': ['space'], // Filter by space tag
            limit: 50,
          }
        ], { signal });

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
      } catch (error) {
        console.error('Failed to fetch spaces:', error);

        // Return default spaces on error
        return DEFAULT_SPACES.map(space => ({
          ...space,
          communityId: communityId || '',
          creator: '',
          event: undefined,
        }));
      }
    },
    enabled: !!communityId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
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

  return useQuery({
    queryKey: ['all-spaces', communityId],
    queryFn: async (c) => {
      if (!communityId) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      try {
        const events = await nostr.query([
          {
            kinds: [39097],
            '#a': [communityId],
            '#t': ['space'],
            limit: 50,
          }
        ], { signal });

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
      } catch (error) {
        console.error('Failed to fetch all spaces:', error);
        return DEFAULT_SPACES.map(space => ({
          ...space,
          communityId: communityId || '',
          creator: '',
          event: undefined,
        }));
      }
    },
    enabled: !!communityId,
    staleTime: 1000 * 60 * 5,
  });
}