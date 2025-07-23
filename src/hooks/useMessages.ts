import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

function validateMessageEvent(event: NostrEvent): boolean {
  // Accept kind 9411 (channel chat messages) and kind 1 (legacy)
  if (![1, 9411].includes(event.kind)) return false;

  // For kind 9411, we expect channel tags
  if (event.kind === 9411) {
    const hasChannelTag = event.tags.some(([name]) => name === 't');
    if (!hasChannelTag) return false;
  }

  // Exclude replies from the main chat feed
  // Replies are events that have 'e' tags referencing other events
  const eTags = event.tags.filter(([name]) => name === 'e');
  if (eTags.length > 0) {
    return false; // This is a reply, don't show in main chat
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

      // Query for channel messages
      const events = await nostr.query([
        {
          kinds: [9411, 1], // Include both new channel messages and legacy formats
          '#t': [channelId], // Channel identifier
          '#a': [`${kind}:${pubkey}:${identifier}`], // Optional community reference
          limit: 100,
        }
      ], { signal });

      const validEvents = events.filter(validateMessageEvent);

      // Sort by created_at (oldest first)
      return validEvents.sort((a, b) => a.created_at - b.created_at);
    },
    enabled: !!communityId && !!channelId,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 10, // Refetch every 10 seconds for real-time feel
  });
}