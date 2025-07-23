import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: 'text' | 'voice';
  communityId: string;
  creator: string;
  event: NostrEvent;
}

interface ChannelContent {
  name: string;
  description?: string;
  type: 'text' | 'voice';
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

  let content: ChannelContent;
  try {
    content = JSON.parse(event.content);
  } catch {
    content = { name, type: channelType };
  }

  return {
    id: d.split(':')[1] || name, // Extract channel name from d tag
    name: content.name || name,
    description: content.description || description,
    type: content.type || channelType,
    communityId,
    creator: event.pubkey,
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

        // Sort channels: text channels first, then voice channels, alphabetically within each type
        return allChannels.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'text' ? -1 : 1;
          }
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