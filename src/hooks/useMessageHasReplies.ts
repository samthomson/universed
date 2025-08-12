import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

function validateReplyEvent(event: NostrEvent, rootId: string): boolean {
  // Must be kind 1, 9411, or 1111 (thread replies/comments)
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

export function useMessageHasReplies(rootEventId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['message-has-replies', rootEventId],
    queryFn: async (c) => {
      if (!rootEventId) return false;

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);

      // Query for events that reference the root event - we only need to know if at least one exists
      const events = await nostr.query([
        {
          kinds: [1, 9411, 1111], // Text notes, channel messages, and thread replies
          '#e': [rootEventId],
          limit: 1, // We only need to know if there's at least one reply
        }
      ], { signal });

      const validEvents = events.filter(event => validateReplyEvent(event, rootEventId));

      return validEvents.length > 0;
    },
    enabled: !!rootEventId,
    refetchInterval: 30 * 1000, // 30 seconds - check for new replies periodically
    staleTime: 15 * 1000, // Consider data fresh for 15 seconds
  });
}

export function useMessageReplyCount(rootEventId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['message-reply-count', rootEventId],
    queryFn: async (c) => {
      if (!rootEventId) return 0;

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);

      // Query for events that reference the root event - get all to count them
      const events = await nostr.query([
        {
          kinds: [1, 9411, 1111], // Text notes, channel messages, and thread replies
          '#e': [rootEventId],
          limit: 500, // Get up to 500 replies
        }
      ], { signal });

      const validEvents = events.filter(event => validateReplyEvent(event, rootEventId));

      return validEvents.length;
    },
    enabled: !!rootEventId,
    refetchInterval: 30 * 1000, // 30 seconds - check for new replies periodically
    staleTime: 15 * 1000, // Consider data fresh for 15 seconds
  });
}
