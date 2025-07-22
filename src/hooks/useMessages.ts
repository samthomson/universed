import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

function validateMessageEvent(event: NostrEvent): boolean {
  // Accept both kind 1111 (NIP-72 community posts) and kind 1 (legacy)
  if (![1, 1111].includes(event.kind)) return false;
  
  // For kind 1111, we expect community tags
  if (event.kind === 1111) {
    const hasATag = event.tags.some(([name]) => name === 'A' || name === 'a');
    if (!hasATag) return false;
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

      // Query for community messages using NIP-72 format
      const events = await nostr.query([
        {
          kinds: [1111, 1], // Include both new and legacy formats
          '#a': [`${kind}:${pubkey}:${identifier}`],
          '#t': [channelId], // Use channel as a tag filter
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