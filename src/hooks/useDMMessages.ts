import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import type { NostrEvent } from '@nostrify/nostrify';

function validateDMEvent(event: NostrEvent): boolean {
  // Accept both NIP-04 (kind 4) and NIP-44 (kind 1059) encrypted DMs
  if (![4, 1059].includes(event.kind)) return false;
  
  // Must have a 'p' tag for the recipient
  const hasP = event.tags.some(([name]) => name === 'p');
  if (!hasP) return false;
  
  return true;
}

export function useDMMessages(conversationId: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['dm-messages', user?.pubkey, conversationId],
    queryFn: async (c) => {
      if (!user || !conversationId) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Query for DMs between us and the other person
      const [sentToThem, receivedFromThem] = await Promise.all([
        // DMs we sent to them
        nostr.query([
          {
            kinds: [4, 1059], // NIP-04 and NIP-44 encrypted DMs
            authors: [user.pubkey],
            '#p': [conversationId],
            limit: 100,
          }
        ], { signal }),
        // DMs they sent to us
        nostr.query([
          {
            kinds: [4, 1059],
            authors: [conversationId],
            '#p': [user.pubkey],
            limit: 100,
          }
        ], { signal }),
      ]);

      const allMessages = [...sentToThem, ...receivedFromThem].filter(validateDMEvent);
      
      // Sort by created_at (oldest first for chronological order)
      return allMessages.sort((a, b) => a.created_at - b.created_at);
    },
    enabled: !!user && !!conversationId,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 10, // Refetch every 10 seconds for real-time feel
  });
}