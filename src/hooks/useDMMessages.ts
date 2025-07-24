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

      // Combined query for DMs in both directions for better performance
      const allMessages = await nostr.query([
        {
          kinds: [4, 1059], // NIP-04 and NIP-44 encrypted DMs
          authors: [user.pubkey, conversationId], // Both users as authors
          '#p': [user.pubkey, conversationId], // Both users as recipients
          limit: 200, // Increased limit to accommodate both directions
        }
      ], { signal });

      // Filter for valid DMs between the two users
      const validMessages = allMessages.filter(event => {
        if (!validateDMEvent(event)) return false;

        // Ensure the message is between the current user and conversation partner
        const isFromUser = event.pubkey === user.pubkey;
        const isToUser = event.tags.some(([name, value]) => name === 'p' && value === user.pubkey);
        const isFromPartner = event.pubkey === conversationId;
        const isToPartner = event.tags.some(([name, value]) => name === 'p' && value === conversationId);

        return (isFromUser && isToPartner) || (isFromPartner && isToUser);
      });

      // Sort by created_at (oldest first for chronological order)
      return validMessages.sort((a, b) => a.created_at - b.created_at);
    },
    enabled: !!user && !!conversationId,
    staleTime: 45 * 1000, // 45 seconds - DMs need reasonable real-time feel
    refetchInterval: 15 * 1000, // 15 seconds - Balanced for DM responsiveness
  });
}