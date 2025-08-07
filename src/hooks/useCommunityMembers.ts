import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCommunities } from './useCommunities';
import type { NostrEvent } from '@nostrify/nostrify';

export interface CommunityMember {
  pubkey: string;
  role: 'owner' | 'moderator' | 'member';
  isOnline: boolean;
  joinedAt?: number;
}

function validateMembershipEvent(event: NostrEvent): boolean {
  if (event.kind !== 34551) return false; // Only approved members list
  const d = event.tags.find(([name]) => name === 'd')?.[1];
  return !!d;
}

export function useCommunityMembers(communityId: string | null) {
  const { nostr } = useNostr();
  const { data: communities } = useCommunities();

  return useQuery({
    queryKey: ['community-members', communityId],
    queryFn: async (c) => {
      if (!communityId) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(2000)]); // BRUTAL: 2s max for members

      // Find the community to get moderators and creator
      const community = communities?.find(c => c.id === communityId);
      if (!community) return [];

      // Parse community ID to get the components
      const [kind, pubkey, identifier] = communityId.split(':');

      if (!kind || !pubkey || !identifier) {
        return [];
      }

      // BRUTAL OPTIMIZATION: Separate queries for different tag types (FIXED)
      const allEvents = await nostr.query([
        {
          kinds: [34551], // Approved members list uses #d tag
          '#d': [communityId],
          limit: 10,
        },
        {
          kinds: [4552, 4553], // Join/leave requests use #a tag
          '#a': [communityId],
          limit: 500,
        },
        {
          kinds: [9411, 1], // Recent activity for online status
          '#a': [communityId],
          limit: 200,
          since: Math.floor(Date.now() / 1000) - (30 * 60), // Last 30 minutes
        }
      ], { signal });

      // Separate by kind in JavaScript (much faster than 4 separate queries)
      const membershipEvents = allEvents.filter(e => e.kind === 34551);
      const joinRequestEvents = allEvents.filter(e => e.kind === 4552);
      const leaveRequestEvents = allEvents.filter(e => e.kind === 4553);
      const activityEvents = allEvents.filter(e => [9411, 1].includes(e.kind));

      const validMembershipEvents = membershipEvents.filter(validateMembershipEvent);

      // Get the most recent approved members list
      const latestMembershipEvent = validMembershipEvents
        .sort((a, b) => b.created_at - a.created_at)[0];

      // Get approved members from the membership list
      const approvedMembers = new Set<string>();
      if (latestMembershipEvent) {
        latestMembershipEvent.tags
          .filter(([name]) => name === 'p')
          .forEach(([, pubkey]) => {
            if (pubkey) approvedMembers.add(pubkey);
          });
      }

      // Get recently active members for online status
      const recentlyActive = new Set(activityEvents.map(e => e.pubkey));

      // Process leave requests to get the most recent leave request per user
      const leaveRequestsByUser = new Map<string, NostrEvent>();
      leaveRequestEvents.forEach(event => {
        const existingLeave = leaveRequestsByUser.get(event.pubkey);
        if (!existingLeave || event.created_at > existingLeave.created_at) {
          leaveRequestsByUser.set(event.pubkey, event);
        }
      });

      // Process join requests to get the most recent join request per user
      const joinRequestsByUser = new Map<string, NostrEvent>();
      joinRequestEvents.forEach(event => {
        const existingJoin = joinRequestsByUser.get(event.pubkey);
        if (!existingJoin || event.created_at > existingJoin.created_at) {
          joinRequestsByUser.set(event.pubkey, event);
        }
      });

      // Build member list
      const members: CommunityMember[] = [];
      const addedMembers = new Set<string>();

      // Helper function to check if user has left the space
      const hasUserLeft = (userPubkey: string): boolean => {
        const leaveRequest = leaveRequestsByUser.get(userPubkey);
        if (!leaveRequest) return false;

        const joinRequest = joinRequestsByUser.get(userPubkey);

        // If there's no join request, user has left
        if (!joinRequest) return true;

        // If leave request is more recent than join request, user has left
        // If join request is more recent than leave request, user has rejoined
        return leaveRequest.created_at > joinRequest.created_at;
      };

      // Add community creator as owner (unless they've left)
      if (!hasUserLeft(community.creator)) {
        members.push({
          pubkey: community.creator,
          role: 'owner',
          isOnline: recentlyActive.has(community.creator),
          joinedAt: community.event.created_at,
        });
        addedMembers.add(community.creator);
      }

      // Add moderators (unless they've left)
      community.moderators.forEach(modPubkey => {
        if (!addedMembers.has(modPubkey) && !hasUserLeft(modPubkey)) {
          members.push({
            pubkey: modPubkey,
            role: 'moderator',
            isOnline: recentlyActive.has(modPubkey),
          });
          addedMembers.add(modPubkey);
        }
      });

      // Add approved members (unless they've left)
      approvedMembers.forEach(memberPubkey => {
        if (!addedMembers.has(memberPubkey) && !hasUserLeft(memberPubkey)) {
          members.push({
            pubkey: memberPubkey,
            role: 'member',
            isOnline: recentlyActive.has(memberPubkey),
          });
          addedMembers.add(memberPubkey);
        }
      });

      // Sort by role priority, then by online status, then by name
      return members.sort((a, b) => {
        const roleOrder = { owner: 0, moderator: 1, member: 2 };
        const roleComparison = roleOrder[a.role] - roleOrder[b.role];
        if (roleComparison !== 0) return roleComparison;

        // Then by online status
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;

        // Then alphabetically by pubkey (could be improved with display names)
        return a.pubkey.localeCompare(b.pubkey);
      });
    },
    enabled: !!communityId && !!communities,
  });
}