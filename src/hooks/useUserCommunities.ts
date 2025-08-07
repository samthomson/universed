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
 * - The creator (owner) AND hasn't left
 * - A moderator AND hasn't left
 * - An approved member AND hasn't left
 *
 * Excludes communities where the user is:
 * - Banned
 * - Declined
 * - Has pending join request
 * - Not a member
 * - Has sent a leave request more recently than any join request (including owners/moderators)
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

      // Check membership status from membership events first (this includes leave request logic)
      const eventBasedStatus = membershipMap.get(community.id);

      // Check if user is the community creator (owner)
      if (community.creator === user.pubkey) {
        // Even if user is owner, check if they've left
        if (eventBasedStatus === 'not-member') {
          return; // Owner has left - skip this community entirely
        }
        membershipStatus = 'owner';
      }
      // Check if user is a moderator
      else if (community.moderators.includes(user.pubkey)) {
        // Even if user is moderator, check if they've left
        if (eventBasedStatus === 'not-member') {
          return; // Moderator has left - skip this community entirely
        }
        membershipStatus = 'moderator';
      }
      // Check membership status from membership events for regular members
      else {
        membershipStatus = eventBasedStatus || 'not-member';
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