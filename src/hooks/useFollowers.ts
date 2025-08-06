import { useQuery } from "@tanstack/react-query";
import { useNostr } from "@nostrify/react";
import { useCurrentUser } from "./useCurrentUser";
import { type Friend, useFriends } from "./useFriends";

/**
 * Hook to fetch users who follow the current user by:
 * 1. Getting the signed-in user's kind 3 (follow list)
 * 2. Fetching all their followees' kind 3s
 * 3. Finding the mutuals (people who both follow each other)
 */
export function useFollowers() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { data: following = [] } = useFriends();

  return useQuery({
    queryKey: ["followers", user?.pubkey, following],
    queryFn: async (c) => {
      if (!user?.pubkey || following.length === 0) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Step 1: Get the current user's follow list (already available via useFriends)
      const followedPubkeys = following.map((friend) => friend.pubkey);

      // Step 2: Fetch kind 3 events from all the people the current user follows
      // Batch query for better performance
      const events = await nostr.query([{
        kinds: [3],
        authors: followedPubkeys,
        limit: followedPubkeys.length * 2, // Allow for multiple events per user
      }], { signal });

      // Step 3: Find mutuals - users who follow back the current user
      const mutuals: Friend[] = [];

      for (const event of events) {
        // Check if this follow list contains the current user
        const followsCurrentUser = event.tags.some(
          ([tagName, pubkey]) => tagName === "p" && pubkey === user.pubkey,
        );

        if (followsCurrentUser) {
          // Find the original friend data to preserve relay and petname info
          const originalFriend = following.find((f) =>
            f.pubkey === event.pubkey
          );

          if (originalFriend) {
            mutuals.push({
              ...originalFriend,
              // We could add additional info from their follow list if needed
            });
          }
        }
      }

      return mutuals;
    },
    enabled: !!user?.pubkey && following.length > 0,
    staleTime: 3 * 60 * 60 * 1000, // Consider data fresh for 60 seconds since this is a more expensive query
  });
}

/**
 * Hook to get mutual friends (users who follow each other)
 * Now uses the refactored useFollowers which directly returns mutuals
 */
export function useMutualFriends() {
  const { data: following = [] } = useFriends();
  const { data: mutuals = [], isLoading: isLoadingMutuals } = useFollowers();

  return {
    data: mutuals,
    isLoading: following === undefined || isLoadingMutuals,
  };
}
