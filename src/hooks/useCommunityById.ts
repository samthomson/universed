import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { isSpamCommunity, parseCommunityEvent } from './useCommunities';
import type { Community } from './useCommunities';

function validateCommunityEvent(event: NostrEvent): boolean {
  if (event.kind !== 34550) return false;

  const d = event.tags.find(([name]) => name === 'd')?.[1];
  if (!d) return false;

  // Filter out spam communities
  if (isSpamCommunity(event)) return false;

  return true;
}

/**
 * Hook to fetch a specific community by its ID.
 * This is useful for direct navigation to communities that may not be in the user's communities list.
 */
export function useCommunityById(communityId: string | null) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['community-by-id', communityId],
    queryFn: async (c): Promise<Community | null> => {
      if (!communityId) return null;

      // Parse the community ID to extract kind, pubkey, and d-tag
      const [kindStr, pubkey, d] = communityId.split(':');
      if (!kindStr || !pubkey || !d) {
        return null;
      }

      const kind = parseInt(kindStr, 10);
      if (isNaN(kind) || kind !== 34550) {
        return null;
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);

      // Query for the specific community event
      const events = await nostr.query([
        {
          kinds: [34550],
          authors: [pubkey],
          '#d': [d],
          limit: 1,
        }
      ], { signal });

      const validEvents = events.filter(validateCommunityEvent);

      if (validEvents.length === 0) {
        return null;
      }

      // Return the first (and should be only) valid community
      return parseCommunityEvent(validEvents[0]);
    },
    enabled: !!communityId,
    staleTime: 1000 * 60 * 15, // 15 minutes - community data doesn't change frequently
    gcTime: 1000 * 60 * 60, // 1 hour - keep in memory for a while
  });
}