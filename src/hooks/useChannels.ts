import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';
import { useCanModerate } from './useCommunityRoles';
import type { NostrEvent } from '@nostrify/nostrify';

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

  return useQuery({
    queryKey: ['channels', communityId],
    queryFn: async (c) => {
      if (!communityId) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      try {
        // Query for channel definition events
        const events = await nostr.query([
          {
            kinds: [32807], // Channel definition events
            '#a': [communityId], // Filter by community
            '#t': ['channel'], // Filter by channel tag
            limit: 100,
          }
        ], { signal });

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

        // Add custom channels that don't conflict with default ones
        customChannels.forEach(customChannel => {
          const isDuplicate = allChannels.some(existing =>
            existing.name.toLowerCase() === customChannel.name.toLowerCase()
          );
          if (!isDuplicate) {
            allChannels.push(customChannel);
          }
        });

        // Sort channels: by folder, then by position, then by type, then alphabetically
        return allChannels.sort((a, b) => {
          // First sort by folder (channels without folder come first)
          if (a.folderId !== b.folderId) {
            if (!a.folderId) return -1;
            if (!b.folderId) return 1;
            return a.folderId.localeCompare(b.folderId);
          }

          // Then by position
          if (a.position !== b.position) {
            return a.position - b.position;
          }

          // Then by type (text first)
          if (a.type !== b.type) {
            return a.type === 'text' ? -1 : 1;
          }

          // Finally alphabetically
          return a.name.localeCompare(b.name);
        });
      } catch (error) {
        console.error('Failed to fetch channels:', error);

        // Return default channels on error
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
        return defaultChannels;
      }
    },
    enabled: !!communityId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
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