import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useQueryDeduplication } from './useQueryDeduplication';
import { reactQueryConfigs } from '@/lib/reactQueryConfigs';

export function useAuthorBatch(pubkeys: (string | undefined)[]) {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { getDeduplicatedQuery, getCachedData, setCachedData } = useQueryDeduplication();

  // Filter out undefined pubkeys and deduplicate
  const validPubkeys = [...new Set(pubkeys.filter(Boolean))] as string[];

  return useQuery<Record<string, { event?: NostrEvent; metadata?: NostrMetadata }>>({
    queryKey: ['authors-batch', validPubkeys.sort()], // Sort for consistent cache keys
    staleTime: reactQueryConfigs['author-batch'].staleTime,
    gcTime: reactQueryConfigs['author-batch'].gcTime,
    queryFn: async ({ signal }) => {
      if (validPubkeys.length === 0) {
        return {};
      }

      // Check cache for individual authors first
      const result: Record<string, { event?: NostrEvent; metadata?: NostrMetadata }> = {};
      const uncachedPubkeys: string[] = [];

      validPubkeys.forEach(pubkey => {
        const cached = getCachedData<{ event?: NostrEvent; metadata?: NostrMetadata }>(['author', pubkey]);
        if (cached) {
          result[pubkey] = cached;
        } else {
          result[pubkey] = {};
          uncachedPubkeys.push(pubkey);
        }
      });

      // If all authors are cached, return immediately
      if (uncachedPubkeys.length === 0) {
        return result;
      }

      // Use deduplication for the query
      const filters = [{ kinds: [0], authors: uncachedPubkeys, limit: uncachedPubkeys.length }];
      
      try {
        const events = await getDeduplicatedQuery(
          `authors-batch-${uncachedPubkeys.sort().join(',')}`,
          filters,
          () => nostr.query(filters, { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) })
        );

        console.debug(`[useAuthorBatch] Loaded ${events.length} profiles out of ${uncachedPubkeys.length} requested`);
        
        // Process found events and cache individually
        events.forEach(event => {
          try {
            const metadata = n.json().pipe(n.metadata()).parse(event.content);
            const authorData = { metadata, event };
            result[event.pubkey] = authorData;

            // Cache individual author for future use
            setCachedData(['author', event.pubkey], authorData, reactQueryConfigs.author.staleTime);
          } catch {
            const authorData = { event };
            result[event.pubkey] = authorData;
            setCachedData(['author', event.pubkey], authorData, reactQueryConfigs.author.staleTime);
          }
        });

        return result;
      } catch (error) {
        console.warn(`[useAuthorBatch] Failed to load profiles:`, error);
        // Return partial result with cached data
        return result;
      }
    },
    enabled: validPubkeys.length > 0,
    retry: 2, // Allow more retries for profile loading
    // Use cached data immediately while fetching
    placeholderData: (previousData) => {
      if (previousData) return previousData;

      // Try to build from individual cached authors
      const cachedResult: Record<string, { event?: NostrEvent; metadata?: NostrMetadata }> = {};
      let hasAnyCache = false;

      validPubkeys.forEach(pubkey => {
        const cached = queryClient.getQueryData<{ event?: NostrEvent; metadata?: NostrMetadata }>(['author', pubkey]);
        if (cached) {
          cachedResult[pubkey] = cached;
          hasAnyCache = true;
        } else {
          cachedResult[pubkey] = {};
        }
      });

      return hasAnyCache ? cachedResult : undefined;
    },
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