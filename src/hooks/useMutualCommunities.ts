import { useMemo } from 'react';
import { useUserCommunities } from './useUserCommunities';
import { useCommunities } from './useCommunities';
import { useUserMembership } from './useUserMembership';
import { useUserMembershipsByPubkey } from './useUserMembershipsByPubkey';
import { useCurrentUser } from './useCurrentUser';
import type { Community } from './useCommunities';

export interface MutualCommunity extends Community {
  currentUserMembership: 'owner' | 'moderator' | 'approved';
  targetUserMembership: 'owner' | 'moderator' | 'approved';
}

/**
 * Hook to get communities that both the current user and target user are members of
 */
export function useMutualCommunities(targetPubkey: string | null) {
  const { data: currentUserCommunities, ...currentUserQuery } = useUserCommunities();
  const { data: allCommunities } = useCommunities();
  const { data: currentUserMemberships } = useUserMembership();
  const { data: targetUserMemberships, ...targetUserQuery } = useUserMembershipsByPubkey(targetPubkey);
  const { user } = useCurrentUser();

  const mutualCommunities = useMemo(() => {
    if (!targetPubkey || !user?.pubkey || !allCommunities || !currentUserMemberships || !targetUserMemberships) {
      return [];
    }

    // Create membership maps for both users
    const currentUserMembershipMap = new Map<string, 'owner' | 'moderator' | 'approved' | 'not-member' | 'pending' | 'declined' | 'banned'>();
    currentUserMemberships.forEach(membership => {
      currentUserMembershipMap.set(membership.communityId, membership.status);
    });

    const targetUserMembershipMap = new Map<string, 'owner' | 'moderator' | 'approved' | 'not-member' | 'pending' | 'declined' | 'banned'>();
    targetUserMemberships.forEach(membership => {
      targetUserMembershipMap.set(membership.communityId, membership.status);
    });

    const mutuals: MutualCommunity[] = [];

    allCommunities.forEach(community => {
      // Check if current user is a member
      const currentUserStatus = getCurrentUserMembershipStatus(community, user.pubkey, currentUserMembershipMap);
      if (!['owner', 'moderator', 'approved'].includes(currentUserStatus)) {
        return; // Current user is not a member
      }

      // Check if target user is a member
      const targetUserStatus = getTargetUserMembershipStatus(community, targetPubkey, targetUserMembershipMap);
      if (!['owner', 'moderator', 'approved'].includes(targetUserStatus)) {
        return; // Target user is not a member
      }

      // Both users are members - add to mutual communities
      mutuals.push({
        ...community,
        currentUserMembership: currentUserStatus as 'owner' | 'moderator' | 'approved',
        targetUserMembership: targetUserStatus as 'owner' | 'moderator' | 'approved',
      });
    });

    // Sort by community name
    return mutuals.sort((a, b) => a.name.localeCompare(b.name));
  }, [targetPubkey, user?.pubkey, allCommunities, currentUserMemberships, targetUserMemberships]);

  // Combine loading states
  const isLoading = currentUserQuery.isLoading || targetUserQuery.isLoading;
  const error = currentUserQuery.error || targetUserQuery.error;

  return {
    data: mutualCommunities,
    isLoading,
    error,
  };
}

function getCurrentUserMembershipStatus(
  community: Community,
  currentUserPubkey: string,
  membershipMap: Map<string, 'owner' | 'moderator' | 'approved' | 'not-member' | 'pending' | 'declined' | 'banned'>
): 'owner' | 'moderator' | 'approved' | 'not-member' {
  // Check if user is the community creator (owner)
  if (community.creator === currentUserPubkey) {
    const eventBasedStatus = membershipMap.get(community.id);
    if (eventBasedStatus === 'not-member') {
      return 'not-member'; // Owner has left
    }
    return 'owner';
  }

  // Check if user is a moderator
  if (community.moderators.includes(currentUserPubkey)) {
    const eventBasedStatus = membershipMap.get(community.id);
    if (eventBasedStatus === 'not-member') {
      return 'not-member'; // Moderator has left
    }
    return 'moderator';
  }

  // Check membership status from membership events
  const eventBasedStatus = membershipMap.get(community.id);
  if (eventBasedStatus && ['owner', 'moderator', 'approved'].includes(eventBasedStatus)) {
    return eventBasedStatus as 'owner' | 'moderator' | 'approved';
  }

  return 'not-member';
}

function getTargetUserMembershipStatus(
  community: Community,
  targetPubkey: string,
  membershipMap: Map<string, 'owner' | 'moderator' | 'approved' | 'not-member' | 'pending' | 'declined' | 'banned'>
): 'owner' | 'moderator' | 'approved' | 'not-member' {
  // Check if target user is the community creator (owner)
  if (community.creator === targetPubkey) {
    const eventBasedStatus = membershipMap.get(community.id);
    if (eventBasedStatus === 'not-member') {
      return 'not-member'; // Owner has left
    }
    return 'owner';
  }

  // Check if target user is a moderator
  if (community.moderators.includes(targetPubkey)) {
    const eventBasedStatus = membershipMap.get(community.id);
    if (eventBasedStatus === 'not-member') {
      return 'not-member'; // Moderator has left
    }
    return 'moderator';
  }

  // Check membership status from membership events
  const eventBasedStatus = membershipMap.get(community.id);
  if (eventBasedStatus && ['owner', 'moderator', 'approved'].includes(eventBasedStatus)) {
    return eventBasedStatus as 'owner' | 'moderator' | 'approved';
  }

  return 'not-member';
}