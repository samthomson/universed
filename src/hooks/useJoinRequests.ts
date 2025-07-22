import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

export interface JoinRequest {
  event: NostrEvent;
  communityId: string;
  requesterPubkey: string;
  message: string;
  createdAt: number;
}

function validateJoinRequestEvent(event: NostrEvent): boolean {
  if (event.kind !== 4552) return false;
  const a = event.tags.find(([name]) => name === 'a')?.[1];
  return !!a;
}

/**
 * Hook to fetch pending join requests for a community.
 * Only returns requests from users who are not already members.
 */
export function useJoinRequests(communityId: string | null) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['join-requests', communityId],
    queryFn: async (c) => {
      if (!communityId) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Query for join requests and membership lists in parallel
      const [joinRequestEvents, membershipEvents] = await Promise.all([
        // Get join requests for this community
        nostr.query([
          {
            kinds: [4552], // Join requests
            '#a': [communityId],
            limit: 100,
            since: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60), // Last 30 days
          }
        ], { signal }),

        // Get current membership lists to filter out existing members
        nostr.query([
          {
            kinds: [34551, 34552, 34553], // Approved, declined, banned lists
            '#d': [communityId],
            limit: 30,
          }
        ], { signal })
      ]);

      const validJoinRequests = joinRequestEvents.filter(validateJoinRequestEvent);

      // Get current members from membership lists
      const currentMembers = new Set<string>();
      const declinedMembers = new Set<string>();
      const bannedMembers = new Set<string>();

      membershipEvents.forEach(event => {
        const memberPubkeys = event.tags
          .filter(([name]) => name === 'p')
          .map(([, pubkey]) => pubkey)
          .filter(Boolean);

        switch (event.kind) {
          case 34551: // Approved members
            memberPubkeys.forEach(pubkey => currentMembers.add(pubkey));
            break;
          case 34552: // Declined members
            memberPubkeys.forEach(pubkey => declinedMembers.add(pubkey));
            break;
          case 34553: // Banned members
            memberPubkeys.forEach(pubkey => bannedMembers.add(pubkey));
            break;
        }
      });

      // Filter join requests to only include pending ones
      const pendingRequests: JoinRequest[] = [];
      const processedUsers = new Set<string>();

      // Sort by creation time (newest first) and process each user only once
      validJoinRequests
        .sort((a, b) => b.created_at - a.created_at)
        .forEach(event => {
          const requesterPubkey = event.pubkey;
          const communityId = event.tags.find(([name]) => name === 'a')?.[1];

          if (!communityId || processedUsers.has(requesterPubkey)) {
            return; // Skip if already processed this user
          }

          processedUsers.add(requesterPubkey);

          // Only include if user is not already a member, declined, or banned
          if (!currentMembers.has(requesterPubkey) && 
              !declinedMembers.has(requesterPubkey) && 
              !bannedMembers.has(requesterPubkey)) {
            pendingRequests.push({
              event,
              communityId,
              requesterPubkey,
              message: event.content,
              createdAt: event.created_at,
            });
          }
        });

      return pendingRequests;
    },
    enabled: !!communityId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}