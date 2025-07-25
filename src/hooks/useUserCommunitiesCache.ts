import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';
import type { Community } from './useCommunities';
import type { UserCommunity } from './useUserCommunities';
import type { MembershipStatus } from './useUserMembership';

/**
 * Hook for managing the user communities cache.
 * Provides functions to update the cache when communities are joined/left
 * without needing to refetch all data.
 */
export function useUserCommunitiesCache() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  // Add a community to the user's cached communities list
  const addCommunityToCache = useCallback((
    community: Community,
    membershipStatus: MembershipStatus = 'approved'
  ) => {
    if (!user?.pubkey) return;

    const queryKey = ['user-communities', user.pubkey];
    const currentData = queryClient.getQueryData<UserCommunity[]>(queryKey);

    if (currentData) {
      // Check if community is already in the list
      const existingIndex = currentData.findIndex(c => c.id === community.id);

      if (existingIndex >= 0) {
        // Update existing community's membership status
        const updatedData = [...currentData];
        updatedData[existingIndex] = { ...community, membershipStatus };

        // Re-sort by membership status
        updatedData.sort((a, b) => {
          const statusOrder = { owner: 0, moderator: 1, approved: 2 };
          return statusOrder[a.membershipStatus] - statusOrder[b.membershipStatus];
        });

        queryClient.setQueryData(queryKey, updatedData);
      } else {
        // Add new community
        const newCommunity: UserCommunity = { ...community, membershipStatus };
        const updatedData = [...currentData, newCommunity];

        // Sort by membership status
        updatedData.sort((a, b) => {
          const statusOrder = { owner: 0, moderator: 1, approved: 2 };
          return statusOrder[a.membershipStatus] - statusOrder[b.membershipStatus];
        });

        queryClient.setQueryData(queryKey, updatedData);
      }
    }
  }, [user?.pubkey, queryClient]);

  // Remove a community from the user's cached communities list
  const removeCommunityFromCache = useCallback((communityId: string) => {
    if (!user?.pubkey) return;

    const queryKey = ['user-communities', user.pubkey];
    const currentData = queryClient.getQueryData<UserCommunity[]>(queryKey);

    if (currentData) {
      const updatedData = currentData.filter(c => c.id !== communityId);
      queryClient.setQueryData(queryKey, updatedData);
    }
  }, [user?.pubkey, queryClient]);

  // Update a community's membership status in the cache
  const updateCommunityMembershipStatus = useCallback((
    communityId: string,
    newStatus: MembershipStatus
  ) => {
    if (!user?.pubkey) return;

    const queryKey = ['user-communities', user.pubkey];
    const currentData = queryClient.getQueryData<UserCommunity[]>(queryKey);

    if (currentData) {
      const existingIndex = currentData.findIndex(c => c.id === communityId);

      if (existingIndex >= 0) {
        const updatedData = [...currentData];
        updatedData[existingIndex] = {
          ...updatedData[existingIndex],
          membershipStatus: newStatus
        };

        // If the new status means the user is no longer a member, remove it
        if (!['owner', 'moderator', 'approved'].includes(newStatus)) {
          updatedData.splice(existingIndex, 1);
        } else {
          // Re-sort by membership status
          updatedData.sort((a, b) => {
            const statusOrder = { owner: 0, moderator: 1, approved: 2 };
            return statusOrder[a.membershipStatus] - statusOrder[b.membershipStatus];
          });
        }

        queryClient.setQueryData(queryKey, updatedData);
      }
    }
  }, [user?.pubkey, queryClient]);

  // Invalidate the user communities cache to force a refresh
  const invalidateUserCommunitiesCache = useCallback(() => {
    if (!user?.pubkey) return;

    queryClient.invalidateQueries({
      queryKey: ['user-communities', user.pubkey],
    });
  }, [user?.pubkey, queryClient]);

  // Prefetch user communities to warm the cache
  const prefetchUserCommunities = useCallback(() => {
    if (!user?.pubkey) return;

    queryClient.prefetchQuery({
      queryKey: ['user-communities', user.pubkey],
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  }, [user?.pubkey, queryClient]);

  // Get current cached user communities without triggering a fetch
  const getCachedUserCommunities = useCallback((): UserCommunity[] | undefined => {
    if (!user?.pubkey) return undefined;

    return queryClient.getQueryData<UserCommunity[]>(['user-communities', user.pubkey]);
  }, [user?.pubkey, queryClient]);

  // Check if a specific community is in the user's cached list
  const isCommunityInCache = useCallback((communityId: string): boolean => {
    const cached = getCachedUserCommunities();
    return cached ? cached.some(c => c.id === communityId) : false;
  }, [getCachedUserCommunities]);

  // Get the count of cached user communities
  const getCachedCommunitiesCount = useCallback((): number => {
    const cached = getCachedUserCommunities();
    return cached ? cached.length : 0;
  }, [getCachedUserCommunities]);

  return {
    addCommunityToCache,
    removeCommunityFromCache,
    updateCommunityMembershipStatus,
    invalidateUserCommunitiesCache,
    prefetchUserCommunities,
    getCachedUserCommunities,
    isCommunityInCache,
    getCachedCommunitiesCount,
  };
}