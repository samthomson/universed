import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

function validateReactionEvent(event: NostrEvent): boolean {
  if (event.kind !== 7) return false;

  // Must have an 'e' tag pointing to the target event
  const hasETag = event.tags.some(([name]) => name === 'e');
  if (!hasETag) return false;

  return true;
}

export function useReactions(eventId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['reactions', eventId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);

      const events = await nostr.query([
        {
          kinds: [7], // Reaction events
          '#e': [eventId],
          limit: 100,
        }
      ], { signal });

      const validEvents = events.filter(validateReactionEvent);

      // Sort by created_at (newest first)
      return validEvents.sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!eventId,
    refetchInterval: 30 * 1000, // 30 seconds - Reduced refetch frequency
  });
}