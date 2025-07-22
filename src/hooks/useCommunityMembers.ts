import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCommunities } from './useCommunities';

export interface CommunityMember {
  pubkey: string;
  role: 'owner' | 'moderator' | 'member';
  isOnline: boolean;
  joinedAt?: number;
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

      // Query for recent community activity to find active members
      const events = await nostr.query([
        {
          kinds: [1111, 1], // Community posts
          '#a': [`${kind}:${pubkey}:${identifier}`],
          limit: 200,
          since: Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60), // Last 7 days
        }
      ], { signal });

      // Get unique authors from recent activity
      const activeMembers = new Set(events.map(e => e.pubkey));
      
      // Build member list
      const members: CommunityMember[] = [];

      // Add community creator as owner
      members.push({
        pubkey: community.creator,
        role: 'owner',
        isOnline: Math.random() > 0.5, // Mock online status for now
      });

      // Add moderators
      community.moderators.forEach(modPubkey => {
        if (modPubkey !== community.creator) {
          members.push({
            pubkey: modPubkey,
            role: 'moderator',
            isOnline: Math.random() > 0.5, // Mock online status for now
          });
        }
      });

      // Add active members
      activeMembers.forEach(memberPubkey => {
        if (!members.some(m => m.pubkey === memberPubkey)) {
          members.push({
            pubkey: memberPubkey,
            role: 'member',
            isOnline: Math.random() > 0.3, // Mock online status for now
          });
        }
      });

      // Sort by role priority, then by online status
      return members.sort((a, b) => {
        const roleOrder = { owner: 0, moderator: 1, member: 2 };
        const roleComparison = roleOrder[a.role] - roleOrder[b.role];
        if (roleComparison !== 0) return roleComparison;
        
        // Then by online status
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        
        return 0;
      });
    },
    enabled: !!communityId && !!communities,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}