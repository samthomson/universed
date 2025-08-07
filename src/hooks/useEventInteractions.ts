import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

interface EventInteractions {
  reactions: NostrEvent[];
  zaps: NostrEvent[];
  comments: NostrEvent[];
}

/**
 * BRUTAL OPTIMIZATION: Single query for ALL event interactions
 * Combines reactions, zaps, and comments into one efficient request
 */
export function useEventInteractions(eventId: string, eventKind?: number, eventPubkey?: string) {
  const { nostr } = useNostr();

  return useQuery<EventInteractions>({
    queryKey: ['event-interactions', eventId],
    queryFn: async ({ signal }) => {
      let filters;

      // For addressable events, use 'a' tag
      if (eventKind && eventKind >= 30000 && eventKind < 40000 && eventPubkey) {
        const identifier = eventId.split(':')[2] || '';
        filters = [{
          kinds: [7, 9735, 1111], // Reactions, zaps, comments
          '#a': [`${eventKind}:${eventPubkey}:${identifier}`],
          limit: 200,
        }];
      } else {
        // For regular events, use 'e' tag
        filters = [{
          kinds: [7, 9735, 1111], // Reactions, zaps, comments
          '#e': [eventId],
          limit: 200,
        }];
      }

      const events = await nostr.query(filters, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(2000)])
      });

      // Separate by kind in JavaScript
      const reactions = events.filter(e => e.kind === 7);
      const zaps = events.filter(e => e.kind === 9735);
      const comments = events.filter(e => e.kind === 1111);

      return { reactions, zaps, comments };
    },
    enabled: !!eventId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // 30 seconds
  });
}

/**
 * Extract specific interaction types
 */
export function useReactionsFromInteractions(interactions: EventInteractions | undefined) {
  return interactions?.reactions.sort((a, b) => b.created_at - a.created_at) || [];
}

export function useZapsFromInteractions(interactions: EventInteractions | undefined) {
  return interactions?.zaps.sort((a, b) => b.created_at - a.created_at) || [];
}

export function useCommentsFromInteractions(interactions: EventInteractions | undefined) {
  return interactions?.comments.sort((a, b) => b.created_at - a.created_at) || [];
}