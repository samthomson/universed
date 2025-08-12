import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useCommunities } from './useCommunities';
import type { MembershipStatus } from './useUserMembership';

export interface UserMembershipByPubkey {
  communityId: string;
  status: MembershipStatus;
  pubkey: string;
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

/**
 * Hook to get community memberships for any user by their pubkey
 */
export function useUserMembershipsByPubkey(targetPubkey: string | null) {
  const { nostr } = useNostr();
  const { data: allCommunities } = useCommunities();

  return useQuery({
    queryKey: ['user-memberships-by-pubkey', targetPubkey],
    queryFn: async (c) => {
      if (!targetPubkey) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Query for membership lists and user's join/leave requests
      const [membershipEvents, userRequestEvents] = await Promise.all([
        // Get all membership lists that might contain this user
        nostr.query([
          {
            kinds: [34551, 34552, 34553], // Approved, declined, banned lists
            '#p': [targetPubkey],
            limit: 100,
          }
        ], { signal }),

        // Get user's join and leave requests
        nostr.query([
          {
            kinds: [4552, 4553], // Join and leave requests
            authors: [targetPubkey],
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
      const allCommunitiesSet = new Set([
        ...Object.keys(membershipByComm),
        ...Object.keys(requestsByComm)
      ]);

      // Also include communities where user might be owner/moderator
      if (allCommunities) {
        allCommunities.forEach(community => {
          if (community.creator === targetPubkey || community.moderators.includes(targetPubkey)) {
            allCommunitiesSet.add(community.id);
          }
        });
      }

      const memberships: UserMembershipByPubkey[] = [];

      allCommunitiesSet.forEach(communityId => {
        const membership = membershipByComm[communityId] || {};
        const requests = requestsByComm[communityId] || {};

        let status: MembershipStatus = 'not-member';

        // Check if user is owner or moderator of this community
        const community = allCommunities?.find(c => c.id === communityId);
        if (community) {
          if (community.creator === targetPubkey) {
            // Check if owner has left
            if (requests.leaveRequest && (!requests.joinRequest ||
                       requests.leaveRequest.created_at > requests.joinRequest.created_at)) {
              status = 'not-member';
            } else {
              status = 'owner';
            }
          } else if (community.moderators.includes(targetPubkey)) {
            // Check if moderator has left
            if (requests.leaveRequest && (!requests.joinRequest ||
                       requests.leaveRequest.created_at > requests.joinRequest.created_at)) {
              status = 'not-member';
            } else {
              status = 'moderator';
            }
          } else {
            // Regular member - check membership status
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
          }
        } else {
          // Community not found in allCommunities, use basic logic
          // Check membership status in priority order
          if (membership.banned) {
            status = 'banned';
          } else if (requests.leaveRequest && (!requests.joinRequest ||
                     requests.leaveRequest.created_at > requests.joinRequest.created_at)) {
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
        }

        memberships.push({
          communityId,
          status,
          pubkey: targetPubkey,
        });
      });

      return memberships;
    },
    enabled: !!targetPubkey && !!allCommunities,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}