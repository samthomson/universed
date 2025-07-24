import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';
import { useCanModerate } from './useCommunityRoles';
import { useEventCache } from './useEventCache';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';

export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: 'text' | 'voice';
  communityId: string;
  creator: string;
  folderId?: string; // Optional folder assignment
  position: number; // Position within folder or root
  event: NostrEvent;
}

interface ChannelContent {
  name: string;
  description?: string;
  type: 'text' | 'voice';
  folderId?: string;
  position?: number;
}

function validateChannelEvent(event: NostrEvent): boolean {
  if (event.kind !== 32807) return false;

  const d = event.tags.find(([name]) => name === 'd')?.[1];
  const communityRef = event.tags.find(([name]) => name === 'a')?.[1];

  if (!d || !communityRef) return false;

  try {
    const content = JSON.parse(event.content) as ChannelContent;
    if (!content.name || !['text', 'voice'].includes(content.type)) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

function parseChannelEvent(event: NostrEvent, communityId: string): Channel {
  const d = event.tags.find(([name]) => name === 'd')?.[1] || '';
  const name = event.tags.find(([name]) => name === 'name')?.[1] || '';
  const description = event.tags.find(([name]) => name === 'description')?.[1];
  const channelType = event.tags.find(([name]) => name === 'channel_type')?.[1] as 'text' | 'voice' || 'text';
  const folderId = event.tags.find(([name]) => name === 'folder')?.[1];
  const position = parseInt(event.tags.find(([name]) => name === 'position')?.[1] || '0');

  let content: ChannelContent;
  try {
    content = JSON.parse(event.content);
  } catch {
    content = { name, type: channelType };
  }

  return {
    id: d || `${communityId}:${name}`, // Use full d tag as ID, or create unique ID
    name: content.name || name,
    description: content.description || description,
    type: content.type || channelType,
    communityId,
    creator: event.pubkey,
    folderId: content.folderId || folderId,
    position: content.position || position,
    event,
  };
}

export function useChannels(communityId: string | null) {
  const { nostr } = useNostr();
  const { getCachedEventsByKind, cacheEvents } = useEventCache();

  return useQuery({
    queryKey: ['channels', communityId],
    queryFn: async (c) => {
      if (!communityId) return [];

      // PRIORITY 1: Check for cached channel events first and return immediately if found
      const cachedChannelEvents = getCachedEventsByKind(32807).filter(event => {
        const communityRef = event.tags.find(([name]) => name === 'a')?.[1];
        return communityRef === communityId && validateChannelEvent(event);
      });

      // If we have cached events, process them immediately and return
      if (cachedChannelEvents.length > 0) {
        const customChannels = cachedChannelEvents.map(event => parseChannelEvent(event, communityId));

        // Always include the default "general" channel
        const defaultChannels: Channel[] = [
          {
            id: 'general',
            name: 'general',
            description: 'General discussion',
            type: 'text',
            communityId,
            creator: '',
            position: 0,
            event: {} as NostrEvent,
          },
        ];

        // Combine default and custom channels, avoiding duplicates
        const allChannels = [...defaultChannels];
        customChannels.forEach(customChannel => {
          const isDuplicate = allChannels.some(existing =>
            existing.name.toLowerCase() === customChannel.name.toLowerCase()
          );
          if (!isDuplicate) {
            allChannels.push(customChannel);
          }
        });

        // Sort and return cached data immediately
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

        // Start background refresh but return cached data immediately
        setTimeout(() => {
          refreshChannelsInBackground(communityId, nostr, cacheEvents);
        }, 100);

        return sortedChannels;
      }

      // PRIORITY 2: No cached data, fetch with very short timeout for immediate response
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]); // Reduced to 1.5 seconds

      try {
        // Query for channel definition events with high priority
        const events = await nostr.query([
          {
            kinds: [32807], // Channel definition events
            '#a': [communityId], // Filter by community
            '#t': ['channel'], // Filter by channel tag
            limit: 50, // Reduced limit for faster response
          }
        ], { signal });

        // Cache the fetched events immediately
        if (events.length > 0) {
          cacheEvents(events);
        }

        const validEvents = events.filter(validateChannelEvent);
        const customChannels = validEvents.map(event => parseChannelEvent(event, communityId));

        // Always include the default "general" channel
        const defaultChannels: Channel[] = [
          {
            id: 'general',
            name: 'general',
            description: 'General discussion',
            type: 'text',
            communityId,
            creator: '',
            position: 0,
            event: {} as NostrEvent,
          },
        ];

        // Combine default and custom channels, avoiding duplicates
        const allChannels = [...defaultChannels];
        customChannels.forEach(customChannel => {
          const isDuplicate = allChannels.some(existing =>
            existing.name.toLowerCase() === customChannel.name.toLowerCase()
          );
          if (!isDuplicate) {
            allChannels.push(customChannel);
          }
        });

        // Sort channels
        return allChannels.sort((a, b) => {
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
      } catch (error) {
        console.warn('Failed to fetch channels quickly, returning default:', error);

        // PRIORITY 3: On error or timeout, return default channels immediately
        const defaultChannels: Channel[] = [
          {
            id: 'general',
            name: 'general',
            description: 'General discussion',
            type: 'text',
            communityId,
            creator: '',
            position: 0,
            event: {} as NostrEvent,
          },
        ];

        // Start background refresh for next time
        setTimeout(() => {
          refreshChannelsInBackground(communityId, nostr, cacheEvents);
        }, 1000);

        return defaultChannels;
      }
    },
    enabled: !!communityId,
    staleTime: 1000 * 60 * 15, // 15 minutes - very long cache since we prioritize cached data
    gcTime: 1000 * 60 * 60, // 1 hour - keep in memory very long
    refetchOnMount: false, // Don't refetch on mount, use cached data
    refetchOnWindowFocus: false, // Don't refetch on focus, use cached data
    refetchOnReconnect: false, // Don't refetch on reconnect, use cached data
  });
}

// Background refresh function that doesn't block the UI
async function refreshChannelsInBackground(
  communityId: string,
  nostr: { query: (filters: NostrFilter[], options: { signal: AbortSignal }) => Promise<NostrEvent[]> },
  cacheEvents: (events: NostrEvent[]) => void
) {
  try {
    const signal = AbortSignal.timeout(10000); // Longer timeout for background refresh
    const events = await nostr.query([
      {
        kinds: [32807],
        '#a': [communityId],
        '#t': ['channel'],
        limit: 100,
      }
    ], { signal });

    if (events.length > 0) {
      cacheEvents(events);
      console.log(`Background refreshed ${events.length} channel events for ${communityId}`);
    }
  } catch (error) {
    console.warn('Background channel refresh failed:', error);
  }
}

export function useUpdateChannel(communityId: string) {
  const { mutateAsync: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const { canModerate } = useCanModerate(communityId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      channelId,
      name,
      description,
      type,
      folderId,
      position,
    }: {
      channelId: string;
      name: string;
      description?: string;
      type: 'text' | 'voice';
      folderId?: string;
      position: number;
    }) => {
      if (!user || !canModerate) {
        throw new Error('Only moderators and admins can update channels');
      }

      const tags = [
        ['d', `${communityId}:${channelId}`],
        ['a', communityId],
        ['name', name],
        ['description', description || ''],
        ['channel_type', type],
        ['position', position.toString()],
        ['t', 'channel'],
        ['alt', `Channel: ${name}`],
      ];

      if (folderId) {
        tags.push(['folder', folderId]);
      }

      await createEvent({
        kind: 32807,
        content: JSON.stringify({
          name,
          description,
          type,
          folderId,
          position,
        }),
        tags,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels', communityId] });
    },
  });
}

export function useDeleteChannel(communityId: string) {
  const { mutateAsync: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const { canModerate } = useCanModerate(communityId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ channelEventId, channelName }: { channelEventId: string; channelName: string }) => {
      if (!user || !canModerate) {
        throw new Error('Only moderators and admins can delete channels');
      }

      // Prevent deletion of the general channel
      if (channelName === 'general') {
        throw new Error('Cannot delete the general channel');
      }

      await createEvent({
        kind: 5, // Deletion event
        content: `Channel "${channelName}" deleted`,
        tags: [
          ['e', channelEventId],
          ['k', '32807'],
          ['alt', `Delete channel: ${channelName}`],
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels', communityId] });
    },
  });
}