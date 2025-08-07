import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrMetadata } from '@nostrify/nostrify';

export function useUserMetadataBatch(pubkeys: string[]) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['user-metadata-batch', pubkeys],
    queryFn: async (c) => {
      if (pubkeys.length === 0) return new Map<string, NostrMetadata>();

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Query for kind 0 metadata events for all users
      const metadataEvents = await nostr.query([
        {
          kinds: [0],
          authors: pubkeys,
          limit: pubkeys.length,
        }
      ], { signal });

      // Create a map of pubkey to metadata
      const metadataMap = new Map<string, NostrMetadata>();

      metadataEvents.forEach(event => {
        try {
          const metadata = JSON.parse(event.content) as NostrMetadata;
          metadataMap.set(event.pubkey, metadata);
        } catch (error) {
          console.warn(`Failed to parse metadata for ${event.pubkey}:`, error);
        }
      });

      return metadataMap;
    },
    enabled: pubkeys.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
}