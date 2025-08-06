import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

function validateMessageEvent(event: NostrEvent): boolean {
  // Accept text notes and channel messages
  if (![1, 9411].includes(event.kind)) return false;

  // Must have content
  if (!event.content.trim()) return false;

  return true;
}

export function useGlobalMessageSearch(query: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['global-message-search', query],
    queryFn: async (c) => {
      if (!query.trim()) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Search for recent messages that might contain the query
      // This is a basic implementation - in a real app you'd want full-text search
      const events = await nostr.query([
        {
          kinds: [1, 9411], // Text notes and channel messages
          limit: 100,
          since: Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60), // Last 7 days
        }
      ], { signal });

      const validEvents = events.filter(validateMessageEvent);

      // Filter by search query (case-insensitive)
      const matchingMessages = validEvents.filter(event =>
        event.content.toLowerCase().includes(query.toLowerCase())
      );

      // Sort by created_at (newest first)
      return matchingMessages
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, 50); // Limit to 50 results
    },
    enabled: !!query.trim(),
  });
}