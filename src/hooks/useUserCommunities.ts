import { useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCommunities, type Community } from './useCommunities';
import { useUserMembership, type MembershipStatus } from './useUserMembership';
import { useCurrentUser } from './useCurrentUser';

export interface UserCommunity extends Community {
  membershipStatus: MembershipStatus;
}

/**
 * Hook that returns only the communities where the current user is a member.
 * This includes communities where the user is:
 * - The creator (owner)
 * - A moderator
 * - An approved member
 *
 * Excludes communities where the user is:
 * - Banned
 * - Declined
 * - Has pending join request
 * - Not a member
 *
 * Features aggressive caching for instant loading after first fetch.
 */
export function useUserCommunities() {
  const { data: allCommunities, ...communityQuery } = useCommunities();
  const { data: userMemberships } = useUserMembership();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  // Compute user communities from all communities and memberships
  const computeUserCommunities = useCallback((
    communities: Community[] | undefined,
    memberships: { communityId: string; status: MembershipStatus }[] | undefined,
    userPubkey: string | undefined
  ): UserCommunity[] => {
    if (!communities || !userPubkey) {
      return [];
    }

    const membershipMap = new Map(
      memberships?.map(m => [m.communityId, m.status]) || []
    );

    const userCommunities: UserCommunity[] = [];

    communities.forEach(community => {
      let membershipStatus: MembershipStatus = 'not-member';

      // Check if user is the community creator (owner)
      if (community.creator === userPubkey) {
        membershipStatus = 'owner';
      }
      // Check if user is a moderator
      else if (community.moderators.includes(userPubkey)) {
        membershipStatus = 'moderator';
      }
      // Check membership status from membership events
      else {
        membershipStatus = membershipMap.get(community.id) || 'not-member';
      }

      // Only include communities where user is a member
      if (['owner', 'moderator', 'approved'].includes(membershipStatus)) {
        userCommunities.push({
          ...community,
          membershipStatus,
        });
      }
    });

    // Sort communities by membership status priority
    return userCommunities.sort((a, b) => {
      const statusOrder = { owner: 0, moderator: 1, approved: 2 };
      return statusOrder[a.membershipStatus] - statusOrder[b.membershipStatus];
    });
  }, []);

  // Use a separate query for user communities with aggressive caching
  const userCommunitiesQuery = useQuery({
    queryKey: ['user-communities', user?.pubkey],
    queryFn: () => computeUserCommunities(allCommunities, userMemberships, user?.pubkey),
    enabled: !!user?.pubkey,
    staleTime: 10 * 60 * 1000, // 10 minutes - Communities don't change often
    gcTime: 60 * 60 * 1000, // 1 hour - Keep in memory for a long time
    refetchOnMount: false, // Don't refetch on mount, rely on background updates
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: true, // Refetch when reconnecting to network
    refetchInterval: 5 * 60 * 1000, // Background refresh every 5 minutes
    // Keep previous data while fetching new data for instant loading
    placeholderData: (previousData) => previousData,
    // Use structural sharing to prevent unnecessary re-renders
    structuralSharing: true,
  });

  // Update the user communities cache whenever dependencies change
  const userCommunities = useMemo(() => {
    const computed = computeUserCommunities(allCommunities, userMemberships, user?.pubkey);

    // Update the cache with the new computed data
    if (user?.pubkey && computed.length > 0) {
      queryClient.setQueryData(['user-communities', user.pubkey], computed);
    }

    return computed;
  }, [allCommunities, userMemberships, user?.pubkey, computeUserCommunities, queryClient]);

  // Return the cached data if available, otherwise the computed data
  const finalData = userCommunitiesQuery.data || userCommunities;

  // Invalidate cache when user joins/leaves communities
  const invalidateUserCommunities = useCallback(() => {
    if (user?.pubkey) {
      queryClient.invalidateQueries({
        queryKey: ['user-communities', user.pubkey],
      });
    }
  }, [user?.pubkey, queryClient]);

  // Manually update cache when a community is joined
  const addCommunityToCache = useCallback((community: Community, membershipStatus: MembershipStatus) => {
    if (!user?.pubkey) return;

    const currentData = queryClient.getQueryData<UserCommunity[]>(['user-communities', user.pubkey]);
    if (currentData) {
      const newCommunity: UserCommunity = { ...community, membershipStatus };
      const updatedData = [...currentData, newCommunity].sort((a, b) => {
        const statusOrder = { owner: 0, moderator: 1, approved: 2 };
        return statusOrder[a.membershipStatus] - statusOrder[b.membershipStatus];
      });

      queryClient.setQueryData(['user-communities', user.pubkey], updatedData);
    }
  }, [user?.pubkey, queryClient]);

  // Manually remove community from cache when left
  const removeCommunityFromCache = useCallback((communityId: string) => {
    if (!user?.pubkey) return;

    const currentData = queryClient.getQueryData<UserCommunity[]>(['user-communities', user.pubkey]);
    if (currentData) {
      const updatedData = currentData.filter(c => c.id !== communityId);
      queryClient.setQueryData(['user-communities', user.pubkey], updatedData);
    }
  }, [user?.pubkey, queryClient]);

  return {
    data: finalData,
    ...communityQuery,
    // Additional cache management functions
    invalidateUserCommunities,
    addCommunityToCache,
    removeCommunityFromCache,
    // Override loading state - if we have cached data, we're not loading
    isLoading: userCommunitiesQuery.isLoading && !finalData?.length,
    // Override error state - prefer showing cached data over errors
    error: finalData?.length ? null : communityQuery.error,
  };
}