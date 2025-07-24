import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

export function useAuthorBatch(pubkeys: (string | undefined)[]) {
  const { nostr } = useNostr();

  // Filter out undefined pubkeys and deduplicate
  const validPubkeys = [...new Set(pubkeys.filter(Boolean))] as string[];

  return useQuery<Record<string, { event?: NostrEvent; metadata?: NostrMetadata }>>({
    queryKey: ['authors-batch', validPubkeys.sort()], // Sort for consistent cache keys
    queryFn: async ({ signal }) => {
      if (validPubkeys.length === 0) {
        return {};
      }

      // Batch query for all authors at once
      const events = await nostr.query(
        [{ kinds: [0], authors: validPubkeys, limit: validPubkeys.length }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]) },
      );

      // Build result map
      const result: Record<string, { event?: NostrEvent; metadata?: NostrMetadata }> = {};

      // Initialize all pubkeys with empty objects
      validPubkeys.forEach(pubkey => {
        result[pubkey] = {};
      });

      // Process found events
      events.forEach(event => {
        try {
          const metadata = n.json().pipe(n.metadata()).parse(event.content);
          result[event.pubkey] = { metadata, event };
        } catch {
          result[event.pubkey] = { event };
        }
      });

      return result;
    },
    enabled: validPubkeys.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes - Profile data changes infrequently
    gcTime: 60 * 60 * 1000, // 1 hour - Keep profile data cached longer
    retry: 2, // Fewer retries for batch queries
  });
}

// Helper hook to get a single author from the batch
export function useAuthorFromBatch(pubkey: string | undefined, batchData: Record<string, { event?: NostrEvent; metadata?: NostrMetadata }> | undefined) {
  if (!pubkey || !batchData) {
    return { data: undefined, isLoading: false, error: null };
  }

  const authorData = batchData[pubkey];
  return {
    data: authorData,
    isLoading: false,
    error: authorData ? null : new Error('Author not found'),
  };
}