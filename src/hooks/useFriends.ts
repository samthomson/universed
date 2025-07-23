import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';

export interface Friend {
  pubkey: string;
  relay?: string;
  petname?: string;
}

/**
 * Hook to fetch the current user's follow list (kind 3 event)
 */
export function useFriends() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['friends', user?.pubkey],
    queryFn: async (c) => {
      if (!user?.pubkey) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]);
      
      // Get the latest follow list (kind 3) for the current user
      const events = await nostr.query([{
        kinds: [3],
        authors: [user.pubkey],
        limit: 1,
      }], { signal });

      if (events.length === 0) return [];

      const followList = events[0];
      
      // Extract friends from p tags
      const friends: Friend[] = followList.tags
        .filter(([tagName]) => tagName === 'p')
        .map(([, pubkey, relay, petname]) => ({
          pubkey,
          relay: relay || undefined,
          petname: petname || undefined,
        }));

      return friends;
    },
    enabled: !!user?.pubkey,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
}

/**
 * Hook to check if a specific user is in the current user's friend list
 */
export function useIsFriend(pubkey: string) {
  const { data: friends = [] } = useFriends();
  
  return friends.some(friend => friend.pubkey === pubkey);
}

/**
 * Hook to get a friend's petname if they're in the follow list
 */
export function useFriendPetname(pubkey: string) {
  const { data: friends = [] } = useFriends();
  
  const friend = friends.find(f => f.pubkey === pubkey);
  return friend?.petname;
}