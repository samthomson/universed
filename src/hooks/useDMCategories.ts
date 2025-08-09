import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useFriends } from './useFriends';
import type { NostrEvent } from '@nostrify/nostrify';

export interface DMConversation {
  id: string; // The other person's pubkey
  pubkey: string;
  lastMessage?: NostrEvent;
  lastMessageTime: number;
  unreadCount: number;
}

export type DMTabType = 'known' | 'newRequests';

export interface DMCategories {
  known: DMConversation[];
  newRequests: DMConversation[];
  markAsResponded: (pubkey: string) => void;
}

function validateDMEvent(event: NostrEvent): boolean {
  // Accept both NIP-04 (kind 4) and NIP-44 (kind 1059) encrypted DMs
  if (![4, 1059].includes(event.kind)) return false;

  // Must have a 'p' tag for the recipient
  const hasP = event.tags.some(([name]) => name === 'p');
  if (!hasP) return false;

  return true;
}

/**
 * Hook to categorize DM conversations into "Known" and "New Requests"
 * - Known: conversations from people you follow and people you've responded to
 * - New Requests: conversations from people you don't follow and haven't responded to
 */
export function useDMCategories() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { data: friends = [] } = useFriends();
  const queryClient = useQueryClient();

  // Function to mark a conversation as responded to (move from New Requests to Known)
  const markAsResponded = (_pubkey: string) => {
    // Invalidate the query to refetch and recategorize
    queryClient.invalidateQueries({ queryKey: ['dm-categories', user?.pubkey, friends] });
  };

  return useQuery({
    queryKey: ['dm-categories', user?.pubkey, friends],
    queryFn: async (c) => {
      if (!user) return { known: [], newRequests: [] };

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(2000)]);

      // Get all DMs (both sent and received)
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

      // Get the set of friend pubkeys for quick lookup
      const friendPubkeys = new Set(friends.map(friend => friend.pubkey));

      // Categorize conversations
      const known: DMConversation[] = [];
      const newRequests: DMConversation[] = [];

      for (const conversation of conversationMap.values()) {
        const isFriend = friendPubkeys.has(conversation.pubkey);

        // Check if we've responded to this person (sent them a DM)
        const hasResponded = validDMs.some(dm =>
          dm.pubkey === user.pubkey &&
          dm.tags.some(([name, pubkey]) => name === 'p' && pubkey === conversation.pubkey)
        );

        if (isFriend || hasResponded) {
          known.push(conversation);
        } else {
          newRequests.push(conversation);
        }
      }

      // Sort both categories by last message time
      known.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
      newRequests.sort((a, b) => b.lastMessageTime - a.lastMessageTime);

      return {
      known,
      newRequests,
      markAsResponded
    };
    },
    enabled: !!user,
    refetchInterval: 1000 * 60, // Refetch every 60 seconds
  });
}