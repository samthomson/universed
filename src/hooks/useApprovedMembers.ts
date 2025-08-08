import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCommunities } from './useCommunities';
import type { NostrEvent } from '@nostrify/nostrify';

function validateMembershipEvent(event: NostrEvent): boolean {
  if (event.kind !== 34551) return false; // Only approved members list
  const d = event.tags.find(([name]) => name === 'd')?.[1];
  return !!d;
}

/**
 * Hook to get the set of approved members for a community.
 * Returns a Set of pubkeys that are approved to post in the community.
 * Includes community creator, moderators, and explicitly approved members.
 */
export function useApprovedMembers(communityId: string | null) {
  const { nostr } = useNostr();
  const { data: communities } = useCommunities();

  return useQuery({
    queryKey: ['approved-members', communityId],
    queryFn: async (c) => {
      if (!communityId || !communities) return new Set<string>();

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(2000)]);

      // Find the community to get creator and moderators
      const community = communities.find(c => c.id === communityId);
      if (!community) return new Set<string>();

      // Parse community ID to get the components
      const [kind, pubkey, identifier] = communityId.split(':');
      if (!kind || !pubkey || !identifier) {
        return new Set<string>();
      }

      // Query for approved members list
      const events = await nostr.query([
        {
          kinds: [34551], // Approved members list
          '#d': [communityId],
          limit: 10,
        }
      ], { signal });

      const validMembershipEvents = events.filter(validateMembershipEvent);

      // Get the most recent approved members list
      const latestMembershipEvent = validMembershipEvents
        .sort((a, b) => b.created_at - a.created_at)[0];

      // Build set of approved members
      const approvedMembers = new Set<string>();

      // Always include the community creator as approved
      approvedMembers.add(community.creator);

      // Always include moderators as approved
      community.moderators.forEach(modPubkey => {
        approvedMembers.add(modPubkey);
      });

      // Add explicitly approved members from the membership list
      if (latestMembershipEvent) {
        latestMembershipEvent.tags
          .filter(([name]) => name === 'p')
          .forEach(([, memberPubkey]) => {
            if (memberPubkey) approvedMembers.add(memberPubkey);
          });
      }

      return approvedMembers;
    },
    enabled: !!communityId && !!communities,
    staleTime: 1000 * 60 * 2, // 2 minutes - members don't change frequently
  });
}