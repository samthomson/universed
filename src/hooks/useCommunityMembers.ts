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

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Find the community to get moderators and creator
      const community = communities?.find(c => c.id === communityId);
      if (!community) return [];

      // Parse community ID to get the components
      const [kind, pubkey, identifier] = communityId.split(':');

      if (!kind || !pubkey || !identifier) {
        return [];
      }

      // Query for approved members list (Kind 34551) and recent activity
      const [membershipEvents, activityEvents] = await Promise.all([
        // Get approved members list
        nostr.query([
          {
            kinds: [34551], // Approved members list
            '#d': [communityId],
            limit: 10,
          }
        ], { signal }),

        // Get recent community activity to determine online status
        nostr.query([
          {
            kinds: [1111, 1], // Community posts and comments
            '#a': [communityId],
            limit: 200,
            since: Math.floor(Date.now() / 1000) - (30 * 60), // Last 30 minutes for "online" status
          }
        ], { signal })
      ]);

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

      // Build member list
      const members: CommunityMember[] = [];
      const addedMembers = new Set<string>();

      // Add community creator as owner
      members.push({
        pubkey: community.creator,
        role: 'owner',
        isOnline: recentlyActive.has(community.creator),
        joinedAt: community.event.created_at,
      });
      addedMembers.add(community.creator);

      // Add moderators
      community.moderators.forEach(modPubkey => {
        if (!addedMembers.has(modPubkey)) {
          members.push({
            pubkey: modPubkey,
            role: 'moderator',
            isOnline: recentlyActive.has(modPubkey),
          });
          addedMembers.add(modPubkey);
        }
      });

      // Add approved members
      approvedMembers.forEach(memberPubkey => {
        if (!addedMembers.has(memberPubkey)) {
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
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}