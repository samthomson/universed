import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';

function validateMessageEvent(event: NostrEvent, expectedChannelId: string): boolean {
  // Accept kind 9411 (channel chat messages) and kind 1 (legacy)
  if (![1, 9411].includes(event.kind)) return false;

  // Exclude replies from the main chat feed
  // Replies are events that have 'e' tags referencing other events
  const eTags = event.tags.filter(([name]) => name === 'e');
  if (eTags.length > 0) {
    return false; // This is a reply, don't show in main chat
  }

  // For kind 9411, we MUST have the correct channel tag
  if (event.kind === 9411) {
    const channelTag = event.tags.find(([name]) => name === 't')?.[1];
    if (!channelTag || channelTag !== expectedChannelId) {
      return false; // Message doesn't belong to this channel
    }
  }

  // For kind 1 (legacy), only allow if it has the correct channel tag OR no channel tag at all (for backward compatibility with general channel)
  if (event.kind === 1) {
    const channelTag = event.tags.find(([name]) => name === 't')?.[1];
    if (channelTag && channelTag !== expectedChannelId) {
      return false; // Message has a different channel tag
    }
    // If no channel tag and we're in general channel, allow it (legacy support)
    if (!channelTag && expectedChannelId !== 'general') {
      return false; // Untagged messages only go to general channel
    }
  }

  return true;
}

export function useMessages(communityId: string, channelId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['messages', communityId, channelId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Parse community ID to get the components
      const [kind, pubkey, identifier] = communityId.split(':');

      if (!kind || !pubkey || !identifier) {
        return [];
      }

      // Query for channel messages - use multiple filters for better coverage
      const filters: NostrFilter[] = [];

      // Primary filter: kind 9411 messages with specific channel tag
      filters.push({
        kinds: [9411],
        '#t': [channelId], // Channel identifier
        '#a': [`${kind}:${pubkey}:${identifier}`], // Community reference
        limit: 50,
      });

      // Secondary filter for legacy kind 1 messages (only for general channel)
      if (channelId === 'general') {
        filters.push({
          kinds: [1],
          '#a': [`${kind}:${pubkey}:${identifier}`], // Community reference
          limit: 50,
        });
      }

      const events = await nostr.query(filters, { signal });

      // Apply strict client-side filtering to ensure channel isolation
      const validEvents = events.filter(event => {
        const isValid = validateMessageEvent(event, channelId);

        // Additional safety check: ensure the event actually belongs to this channel
        if (isValid && event.kind === 9411) {
          const eventChannelId = event.tags.find(([name]) => name === 't')?.[1];
          if (eventChannelId !== channelId) {
            return false;
          }
        }

        return isValid;
      });

      // Sort by created_at (oldest first)
      return validEvents.sort((a, b) => a.created_at - b.created_at);
    },
    enabled: !!communityId && !!channelId,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 10, // Refetch every 10 seconds for real-time feel
  });
}