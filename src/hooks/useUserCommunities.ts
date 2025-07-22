import { useMemo } from 'react';
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
 */
export function useUserCommunities() {
  const { data: allCommunities, ...communityQuery } = useCommunities();
  const { data: userMemberships } = useUserMembership();
  const { user } = useCurrentUser();

  const userCommunities = useMemo(() => {
    if (!allCommunities || !user?.pubkey) {
      return [];
    }

    const membershipMap = new Map(
      userMemberships?.map(m => [m.communityId, m.status]) || []
    );

    const communities: UserCommunity[] = [];

    allCommunities.forEach(community => {
      let membershipStatus: MembershipStatus = 'not-member';

      // Check if user is the community creator (owner)
      if (community.creator === user.pubkey) {
        membershipStatus = 'owner';
      }
      // Check if user is a moderator
      else if (community.moderators.includes(user.pubkey)) {
        membershipStatus = 'moderator';
      }
      // Check membership status from membership events
      else {
        membershipStatus = membershipMap.get(community.id) || 'not-member';
      }

      // Only include communities where user is a member
      if (['owner', 'moderator', 'approved'].includes(membershipStatus)) {
        communities.push({
          ...community,
          membershipStatus,
        });
      }
    });

    // Sort communities by membership status priority
    return communities.sort((a, b) => {
      const statusOrder = { owner: 0, moderator: 1, approved: 2 };
      return statusOrder[a.membershipStatus] - statusOrder[b.membershipStatus];
    });
  }, [allCommunities, userMemberships, user?.pubkey]);

  return {
    data: userCommunities,
    ...communityQuery,
  };
}