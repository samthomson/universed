import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCommunities } from './useCommunities';
import { useCommunitySettings } from './useCommunitySettings';
import type { NostrEvent } from '@nostrify/nostrify';

function validateMembershipEvent(event: NostrEvent): boolean {
  if (event.kind !== 34551) return false; // Only approved members list
  const d = event.tags.find(([name]) => name === 'd')?.[1];
  return !!d;
}

/**
 * Hook to get the set of approved members for a community.
 * Returns a Set of pubkeys that are approved to post in the community.
 * If requireApproval is disabled, returns null to indicate no filtering should be applied.
 * Otherwise includes community creator, moderators, and explicitly approved members.
 */
export function useApprovedMembers(communityId: string | null) {
  const { nostr } = useNostr();
  const { data: communities } = useCommunities();
  const { data: settings } = useCommunitySettings(communityId);

  return useQuery({
    queryKey: ['approved-members', communityId, settings?.requireApproval],
    queryFn: async (c) => {
      if (!communityId || !communities || !settings) return { members: [], requireApproval: false };

      // If approval is not required, return stable object to indicate no filtering
      if (!settings.requireApproval) {
        return { members: [], requireApproval: false };
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(2000)]);

      // Find the community to get creator and moderators
      const community = communities.find(c => c.id === communityId);
      if (!community) return { members: [], requireApproval: true };

      // Parse community ID to get the components
      const [kind, pubkey, identifier] = communityId.split(':');
      if (!kind || !pubkey || !identifier) {
        return { members: [], requireApproval: true };
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

      // Build array of approved members for stable sorting
      const approvedMembersList = [community.creator, ...community.moderators];

      // Add explicitly approved members from the membership list
      if (latestMembershipEvent) {
        latestMembershipEvent.tags
          .filter(([name]) => name === 'p')
          .forEach(([, memberPubkey]) => {
            if (memberPubkey && !approvedMembersList.includes(memberPubkey)) {
              approvedMembersList.push(memberPubkey);
            }
          });
      }

      return { 
        members: approvedMembersList.sort(), // Sort for stable reference
        requireApproval: true 
      };
    },
    enabled: !!communityId && !!communities && !!settings,
    staleTime: 1000 * 60 * 2, // 2 minutes - members don't change frequently
    // Use select to convert stable data structure to Set for backward compatibility
    select: (data) => {
      if (!data.requireApproval) {
        return null; // No filtering required
      }
      return new Set(data.members);
    },
  });
}