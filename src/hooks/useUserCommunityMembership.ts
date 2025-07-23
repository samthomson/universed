import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useCurrentUser } from './useCurrentUser';
import { useCommunities } from './useCommunities';

export type MembershipStatus =
  | 'owner'
  | 'moderator'
  | 'approved'
  | 'pending'
  | 'declined'
  | 'banned'
  | 'not-member';

function validateMembershipEvent(event: NostrEvent): boolean {
  // Validate membership list events (34551, 34552, 34553)
  if ([34551, 34552, 34553].includes(event.kind)) {
    const d = event.tags.find(([name]) => name === 'd')?.[1];
    return !!d;
  }

  // Validate join/leave request events (4552, 4553)
  if ([4552, 4553].includes(event.kind)) {
    const a = event.tags.find(([name]) => name === 'a')?.[1];
    return !!a;
  }

  return false;
}

/**
 * Hook to get the current user's membership status for a specific community
 */
export function useUserCommunityMembership(communityId: string | null) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { data: communities } = useCommunities();

  return useQuery({
    queryKey: ['user-community-membership', user?.pubkey, communityId],
    queryFn: async (c) => {
      if (!user?.pubkey || !communityId) return 'not-member' as MembershipStatus;

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // First check if user is owner or moderator from community definition
      const community = communities?.find(c => c.id === communityId);
      if (community) {
        if (community.creator === user.pubkey) {
          return 'owner' as MembershipStatus;
        }
        if (community.moderators.includes(user.pubkey)) {
          return 'moderator' as MembershipStatus;
        }
      }

      // Query for membership lists and user's join/leave requests
      const [membershipEvents, userRequestEvents] = await Promise.all([
        // Get membership lists for this community that contain this user
        nostr.query([
          {
            kinds: [34551, 34552, 34553], // Approved, declined, banned lists
            '#d': [communityId],
            '#p': [user.pubkey],
            limit: 10,
          }
        ], { signal }),

        // Get user's join and leave requests for this community
        nostr.query([
          {
            kinds: [4552, 4553], // Join and leave requests
            authors: [user.pubkey],
            '#a': [communityId],
            limit: 10,
          }
        ], { signal })
      ]);

      const validMembershipEvents = membershipEvents.filter(validateMembershipEvent);
      const validUserRequestEvents = userRequestEvents.filter(validateMembershipEvent);

      // Check membership status in priority order

      // Check if banned (highest priority)
      const bannedEvent = validMembershipEvents.find(e => e.kind === 34553);
      if (bannedEvent) {
        return 'banned';
      }

      // Check if approved
      const approvedEvent = validMembershipEvents.find(e => e.kind === 34551);
      if (approvedEvent) {
        return 'approved';
      }

      // Check if declined
      const declinedEvent = validMembershipEvents.find(e => e.kind === 34552);
      if (declinedEvent) {
        return 'declined';
      }

      // Check for pending join request
      const joinRequests = validUserRequestEvents.filter(e => e.kind === 4552);
      const leaveRequests = validUserRequestEvents.filter(e => e.kind === 4553);

      if (joinRequests.length > 0) {
        // Get the most recent join request
        const latestJoinRequest = joinRequests.sort((a, b) => b.created_at - a.created_at)[0];

        // Check if there's a more recent leave request
        const latestLeaveRequest = leaveRequests.sort((a, b) => b.created_at - a.created_at)[0];

        if (!latestLeaveRequest || latestJoinRequest.created_at > latestLeaveRequest.created_at) {
          return 'pending';
        }
      }

      return 'not-member';
    },
    enabled: !!user?.pubkey && !!communityId && !!communities,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}