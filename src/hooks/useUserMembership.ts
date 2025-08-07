import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useCurrentUser } from './useCurrentUser';

export type MembershipStatus =
  | 'owner'
  | 'moderator'
  | 'approved'
  | 'pending'
  | 'declined'
  | 'banned'
  | 'not-member';

export interface UserMembership {
  communityId: string;
  status: MembershipStatus;
  joinRequestEvent?: NostrEvent;
  leaveRequestEvent?: NostrEvent;
}

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

export function useUserMembership() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['user-membership', user?.pubkey],
    queryFn: async (c) => {
      if (!user?.pubkey) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Query for membership lists and user's join/leave requests
      const [membershipEvents, userRequestEvents] = await Promise.all([
        // Get all membership lists that might contain this user
        nostr.query([
          {
            kinds: [34551, 34552, 34553], // Approved, declined, banned lists
            '#p': [user.pubkey],
            limit: 100,
          }
        ], { signal }),

        // Get user's join and leave requests
        nostr.query([
          {
            kinds: [4552, 4553], // Join and leave requests
            authors: [user.pubkey],
            limit: 100,
          }
        ], { signal })
      ]);

      const validMembershipEvents = membershipEvents.filter(validateMembershipEvent);
      const validUserRequestEvents = userRequestEvents.filter(validateMembershipEvent);

      // Group membership events by community
      const membershipByComm: Record<string, {
        approved?: NostrEvent;
        declined?: NostrEvent;
        banned?: NostrEvent;
      }> = {};

      validMembershipEvents.forEach(event => {
        const communityId = event.tags.find(([name]) => name === 'd')?.[1];
        if (!communityId) return;

        if (!membershipByComm[communityId]) {
          membershipByComm[communityId] = {};
        }

        switch (event.kind) {
          case 34551: // Approved members
            membershipByComm[communityId].approved = event;
            break;
          case 34552: // Declined members
            membershipByComm[communityId].declined = event;
            break;
          case 34553: // Banned members
            membershipByComm[communityId].banned = event;
            break;
        }
      });

      // Group user requests by community
      const requestsByComm: Record<string, {
        joinRequest?: NostrEvent;
        leaveRequest?: NostrEvent;
      }> = {};

      validUserRequestEvents.forEach(event => {
        const communityId = event.tags.find(([name]) => name === 'a')?.[1];
        if (!communityId) return;

        if (!requestsByComm[communityId]) {
          requestsByComm[communityId] = {};
        }

        switch (event.kind) {
          case 4552: // Join request
            // Keep the most recent join request
            if (!requestsByComm[communityId].joinRequest ||
                event.created_at > requestsByComm[communityId].joinRequest!.created_at) {
              requestsByComm[communityId].joinRequest = event;
            }
            break;
          case 4553: // Leave request
            // Keep the most recent leave request
            if (!requestsByComm[communityId].leaveRequest ||
                event.created_at > requestsByComm[communityId].leaveRequest!.created_at) {
              requestsByComm[communityId].leaveRequest = event;
            }
            break;
        }
      });

      // Combine all communities and determine status
      const allCommunities = new Set([
        ...Object.keys(membershipByComm),
        ...Object.keys(requestsByComm)
      ]);

      const memberships: UserMembership[] = [];

      allCommunities.forEach(communityId => {
        const membership = membershipByComm[communityId] || {};
        const requests = requestsByComm[communityId] || {};

        let status: MembershipStatus = 'not-member';

        // Check membership status in priority order
        // Leave requests should override all other statuses except banned
        if (membership.banned) {
          status = 'banned';
        } else if (requests.leaveRequest && (!requests.joinRequest ||
                   requests.leaveRequest.created_at > requests.joinRequest.created_at)) {
          // User has left the space - they should not appear as a member
          status = 'not-member';
        } else if (membership.approved) {
          status = 'approved';
        } else if (membership.declined) {
          status = 'declined';
        } else if (requests.joinRequest && !requests.leaveRequest) {
          status = 'pending';
        } else if (requests.joinRequest && requests.leaveRequest &&
                   requests.joinRequest.created_at > requests.leaveRequest.created_at) {
          status = 'pending';
        }

        // Note: owner and moderator status will be determined by checking
        // the community definition event separately in the useCommunities hook

        memberships.push({
          communityId,
          status,
          joinRequestEvent: requests.joinRequest,
          leaveRequestEvent: requests.leaveRequest,
        });
      });

      return memberships;
    },
    enabled: !!user?.pubkey,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}