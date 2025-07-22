import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

function validatePostEvent(event: NostrEvent): boolean {
  // Accept text notes and community posts
  if (![1, 1111].includes(event.kind)) return false;
  
  // Must have content
  if (!event.content.trim()) return false;
  
  // Skip replies (events with 'e' tags)
  const hasETag = event.tags.some(([name]) => name === 'e');
  if (hasETag) return false;
  
  return true;
}

export function useUserPosts(pubkey: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['user-posts', pubkey],
    queryFn: async (c) => {
      if (!pubkey) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Query for posts by this user
      const events = await nostr.query([
        {
          kinds: [1, 1111], // Text notes and community posts
          authors: [pubkey],
          limit: 50,
        }
      ], { signal });

      const validEvents = events.filter(validatePostEvent);
      
      // Sort by created_at (newest first)
      return validEvents.sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!pubkey,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}