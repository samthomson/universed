import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import type { NostrEvent } from '@nostrify/nostrify';

export interface DMConversation {
  id: string; // The other person's pubkey
  pubkey: string;
  lastMessage?: NostrEvent;
  lastMessageTime: number;
  unreadCount: number;
}

export interface AllDMsData {
  conversations: DMConversation[];
  allDMEvents: NostrEvent[];
}

/**
 * Shared validation function for DM events
 */
export function validateDMEvent(event: NostrEvent): boolean {
  // Accept both NIP-04 (kind 4) and NIP-44 (kind 1059) encrypted DMs
  if (![4, 1059].includes(event.kind)) return false;

  // Must have a 'p' tag for the recipient
  const hasP = event.tags.some(([name]) => name === 'p');
  if (!hasP) return false;

  return true;
}

/**
 * Base hook that fetches all DM events and groups them by conversation
 * This serves as the single source of truth for all DM-related data
 */
export function useAllDMs() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery<AllDMsData>({
    queryKey: ['all-dms', user?.pubkey],
    queryFn: async (c) => {
      if (!user) return { conversations: [], allDMEvents: [] };

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(2000)]);

      // Single query to fetch all DMs (both sent and received)
      const allDMs = await nostr.query([
        {
          kinds: [4, 1059], // DMs sent to us
          '#p': [user.pubkey],
          limit: 200,
        },
        {
          kinds: [4, 1059], // DMs sent by us
          authors: [user.pubkey],
          limit: 200,
        }
      ], { signal });

      const validDMs = allDMs.filter(validateDMEvent);

      // Group by conversation (other person's pubkey)
      const conversationMap = new Map<string, DMConversation>();

      validDMs.forEach(dm => {
        // Determine the other person's pubkey
        let otherPubkey: string;
        if (dm.pubkey === user.pubkey) {
          // We sent this DM, find the recipient
          const pTag = dm.tags.find(([name]) => name === 'p');
          otherPubkey = pTag?.[1] || '';
        } else {
          // We received this DM
          otherPubkey = dm.pubkey;
        }

        if (!otherPubkey) return;

        const existing = conversationMap.get(otherPubkey);
        if (!existing || dm.created_at > existing.lastMessageTime) {
          conversationMap.set(otherPubkey, {
            id: otherPubkey,
            pubkey: otherPubkey,
            lastMessage: dm,
            lastMessageTime: dm.created_at,
            unreadCount: 0, // TODO: Implement read status tracking
          });
        }
      });

      // Convert to array and sort by last message time
      const conversations = Array.from(conversationMap.values())
        .sort((a, b) => b.lastMessageTime - a.lastMessageTime);

      return {
        conversations,
        allDMEvents: validDMs,
      };
    },
    enabled: !!user,
    refetchInterval: 1000 * 60, // Refetch every 60 seconds
  });
}