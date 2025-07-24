import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

export interface CommunityMemberLists {
  approved: string[];
  declined: string[];
  banned: string[];
}

function validateMemberListEvent(event: NostrEvent): boolean {
  if (![34551, 34552, 34553].includes(event.kind)) return false;
  const d = event.tags.find(([name]) => name === 'd')?.[1];
  return !!d;
}

/**
 * Hook to fetch community member lists (approved, declined, banned).
 * Returns the most recent lists for each category.
 */
export function useCommunityMemberLists(communityId: string | null) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['community-members', communityId],
    queryFn: async (c) => {
      if (!communityId) return { approved: [], declined: [], banned: [] };

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Query for all member list events
      const memberListEvents = await nostr.query([
        {
          kinds: [34551, 34552, 34553], // Approved, declined, banned lists
          '#d': [communityId],
          limit: 100,
        }
      ], { signal });

      const validEvents = memberListEvents.filter(validateMemberListEvent);

      // Group events by kind and get the most recent for each
      const eventsByKind = validEvents.reduce((acc, event) => {
        if (!acc[event.kind]) {
          acc[event.kind] = [];
        }
        acc[event.kind].push(event);
        return acc;
      }, {} as Record<number, NostrEvent[]>);

      // Get the most recent event for each kind
      const getLatestEvent = (kind: number): NostrEvent | null => {
        const events = eventsByKind[kind] || [];
        return events.sort((a, b) => b.created_at - a.created_at)[0] || null;
      };

      const latestApproved = getLatestEvent(34551);
      const latestDeclined = getLatestEvent(34552);
      const latestBanned = getLatestEvent(34553);

      // Extract member pubkeys from each list
      const extractMembers = (event: NostrEvent | null): string[] => {
        if (!event) return [];
        return event.tags
          .filter(([name]) => name === 'p')
          .map(([, pubkey]) => pubkey)
          .filter(Boolean);
      };

      const members: CommunityMemberLists = {
        approved: extractMembers(latestApproved),
        declined: extractMembers(latestDeclined),
        banned: extractMembers(latestBanned),
      };

      return members;
    },
    enabled: !!communityId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}