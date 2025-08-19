import { useMemo } from 'react';
import { useCommunities, type Community } from './useCommunities';
import { useUserMembership, type MembershipStatus } from './useUserMembership';
import { useCurrentUser } from './useCurrentUser';
import { useUserSettings } from './useUserSettings';
import { logger } from '@/lib/logger';

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
  const { settings } = useUserSettings();
  
  // Log when setting changes for debugging
  logger.log(`COMMUNITY_DISCOVERY: Show pending communities setting: ${settings.showPendingCommunities}`);

  const userCommunities = useMemo(() => {
    if (!allCommunities || !user?.pubkey) {
      return [];
    }

    // Log the filtering process for debugging
    logger.log(`COMMUNITY_DISCOVERY: Filtering ${allCommunities.length} communities with pending=${settings.showPendingCommunities}`);

    const membershipMap = new Map(
      userMemberships?.map(m => [m.communityId, m.status]) || []
    );

    // Check for communities user has memberships for but that might be missing due to spam filtering
    if (userMemberships && settings.enableSpamFiltering) {
      const communityIds = new Set(allCommunities.map(c => c.id));
      const missingMemberships = userMemberships.filter(m => 
        !communityIds.has(m.communityId) && 
        ['owner', 'moderator', 'approved', 'pending'].includes(m.status)
      );
      
      if (missingMemberships.length > 0) {
        logger.log(`COMMUNITY_DISCOVERY: ${missingMemberships.length} user memberships missing from communities (likely spam filtered):`);
        missingMemberships.forEach(m => {
          const communityName = m.communityId.split(':').pop() || 'Unknown';
          logger.log(`COMMUNITY_DISCOVERY: Missing membership: "${communityName}" - Status: ${m.status}`);
        });
      }
    }

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

      // Use user setting to determine if pending communities should be shown
      const allowedStatuses = settings.showPendingCommunities 
        ? ['owner', 'moderator', 'approved', 'pending']
        : ['owner', 'moderator', 'approved'];
        
      if (allowedStatuses.includes(membershipStatus)) {
        communities.push({
          ...community,
          membershipStatus,
        });
      } else if (membershipStatus === 'pending') {
        logger.log(`COMMUNITY_DISCOVERY: Skipping pending community "${community.name}" (setting: ${settings.showPendingCommunities})`);
      }
    });

    // Sort communities by membership status priority
    const sortedCommunities = communities.sort((a, b) => {
      const statusOrder = { owner: 0, moderator: 1, approved: 2, pending: 3 };
      return statusOrder[a.membershipStatus] - statusOrder[b.membershipStatus];
    });

    logger.log(`COMMUNITY_DISCOVERY: Final result: ${sortedCommunities.length} communities (${sortedCommunities.filter(c => c.membershipStatus === 'pending').length} pending)`);
    
    return sortedCommunities;
  }, [allCommunities, userMemberships, user?.pubkey, settings.showPendingCommunities]);

  return {
    data: userCommunities,
    ...communityQuery,
    // Force refetch when pending setting changes
    refetch: communityQuery.refetch,
  };
}