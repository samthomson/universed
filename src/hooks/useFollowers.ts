import { useQuery } from "@tanstack/react-query";
import { useNostr } from "@nostrify/react";
import { useCurrentUser } from "./useCurrentUser";
import { type Friend, useFriends } from "./useFriends";

/**
 * Hook to fetch users who follow the current user (people who have the current user in their kind 3 follow list)
 */
export function useFollowers() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ["followers", user?.pubkey],
    queryFn: async (c) => {
      if (!user?.pubkey) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]);

      // Get all kind 3 events that mention the current user in their p tags
      const events = await nostr.query([{
        kinds: [3],
        "#p": [user.pubkey],
        limit: 100, // Reasonable limit for performance
      }], { signal });

      // Extract followers from the events
      const followers: Friend[] = events.map((event) => ({
        pubkey: event.pubkey,
        // We don't have relay or petname info from other people's follow lists
        relay: undefined,
        petname: undefined,
      }));

      return followers;
    },
    enabled: !!user?.pubkey,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
}

/**
 * Hook to get mutual friends (users who follow each other)
 */
export function useMutualFriends() {
  const { data: following = [] } = useFriends();
  const { data: followers = [] } = useFollowers();

  // Find intersection of following and followers
  const mutualFriends = following.filter((friend) =>
    followers.some((follower) => follower.pubkey === friend.pubkey)
  );

  return {
    data: mutualFriends,
    isLoading: following === undefined || followers === undefined,
  };
}
