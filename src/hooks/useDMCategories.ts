import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAllDMs, type DMConversation } from './useAllDMs';
import { useFriends } from './useFriends';
import { useCurrentUser } from './useCurrentUser';

export type DMTabType = 'known' | 'newRequests';

export interface DMCategories {
  known: DMConversation[];
  newRequests: DMConversation[];
  markAsResponded: (pubkey: string) => void;
}

/**
 * Hook to categorize DM conversations into "Known" and "New Requests"
 * - Known: conversations from people you follow and people you've responded to
 * - New Requests: conversations from people you don't follow and haven't responded to
 * Now uses the base useAllDMs hook to avoid query duplication
 */
export function useDMCategories() {
  const { data: allDMsData } = useAllDMs();
  const { data: friends = [] } = useFriends();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  // Function to mark a conversation as responded to (move from New Requests to Known)
  const markAsResponded = (_pubkey: string) => {
    // Invalidate the base query to refetch and recategorize
    queryClient.invalidateQueries({ queryKey: ['all-dms', user?.pubkey] });
  };

  return useQuery({
    queryKey: ['dm-categories', allDMsData?.conversations, friends],
    queryFn: () => {
      if (!allDMsData || !user) return { known: [], newRequests: [], markAsResponded };

      const { conversations, allDMEvents } = allDMsData;

      // Get the set of friend pubkeys for quick lookup
      const friendPubkeys = new Set(friends.map(friend => friend.pubkey));

      // Categorize conversations
      const known: DMConversation[] = [];
      const newRequests: DMConversation[] = [];

      for (const conversation of conversations) {
        const isFriend = friendPubkeys.has(conversation.pubkey);

        // Check if we've responded to this person (sent them a DM)
        const hasResponded = allDMEvents.some(dm =>
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
    enabled: !!allDMsData && !!user,
    // Keep the same refetch interval as the base hook
    refetchInterval: 1000 * 60,
  });
}