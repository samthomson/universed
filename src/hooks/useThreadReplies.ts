import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

function validateReplyEvent(event: NostrEvent, rootId: string): boolean {
  // Must be kind 1, 9411, or 1111 (Comment events per NIP-22)
  if (![1, 9411, 1111].includes(event.kind)) return false;

  // Must have an 'e' tag pointing to the root or another reply
  const eTags = event.tags.filter(([name]) => name === 'e');
  if (eTags.length === 0) return false;

  // Check if this is a reply to the root or part of the thread
  const hasRootReference = eTags.some(([, eventId, , marker]) =>
    eventId === rootId && (marker === 'root' || marker === 'reply' || !marker)
  );

  return hasRootReference;
}

export function useThreadReplies(rootEventId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['thread-replies', rootEventId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Query for events that reference the root event
      const events = await nostr.query([
        {
          kinds: [1, 9411, 1111], // Text notes, channel messages, and comment events
          '#e': [rootEventId],
          limit: 100,
        }
      ], { signal });

      const validEvents = events.filter(event => validateReplyEvent(event, rootEventId));

      // Sort by created_at (oldest first for chronological thread)
      return validEvents.sort((a, b) => a.created_at - b.created_at);
    },
    enabled: !!rootEventId,
    refetchInterval: 20 * 1000, // 20 seconds - Reduced refetch frequency
  });
}