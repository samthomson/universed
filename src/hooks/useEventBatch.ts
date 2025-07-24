import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';

interface EventBatchOptions {
  kinds: number[];
  authors?: string[];
  tags?: Record<string, string[]>;
  since?: number;
  until?: number;
  limit?: number;
  staleTime?: number;
  refetchInterval?: number;
}

export function useEventBatch(
  queryKey: string[],
  options: EventBatchOptions,
  enabled: boolean = true
) {
  const { nostr } = useNostr();

  return useQuery<NostrEvent[]>({
    queryKey: ['events-batch', ...queryKey, options],
    queryFn: async ({ signal }) => {
      const filter: NostrFilter = {
        kinds: options.kinds,
        limit: options.limit || 100,
      };

      if (options.authors?.length) {
        filter.authors = options.authors;
      }

      if (options.tags) {
        Object.entries(options.tags).forEach(([tagName, values]) => {
          if (values.length > 0) {
            (filter as Record<string, unknown>)[`#${tagName}`] = values;
          }
        });
      }

      if (options.since) {
        filter.since = options.since;
      }

      if (options.until) {
        filter.until = options.until;
      }

      const events = await nostr.query(
        [filter],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }
      );

      // Sort by created_at (newest first by default)
      return events.sort((a, b) => b.created_at - a.created_at);
    },
    enabled,
    staleTime: options.staleTime || 2 * 60 * 1000, // 2 minutes default
    refetchInterval: options.refetchInterval,
    retry: 2,
  });
}

// Specialized hook for message-related events (combines kinds 1, 9411, 7, 1111)
export function useMessageRelatedEvents(
  communityId: string,
  channelId?: string,
  options: Partial<EventBatchOptions> = {}
) {
  const [kind, pubkey, identifier] = communityId.split(':');

  const tags: Record<string, string[]> = {
    a: [`${kind}:${pubkey}:${identifier}`],
  };

  if (channelId) {
    tags.t = [channelId];
  }

  return useEventBatch(
    ['message-related', communityId, channelId || 'all'],
    {
      kinds: [1, 9411, 7, 1111], // Messages, reactions, comments
      tags,
      limit: 150, // Higher limit to capture all related events
      staleTime: 30 * 1000, // 30 seconds for real-time feel
      refetchInterval: 15 * 1000, // 15 seconds
      ...options,
    },
    !!(kind && pubkey && identifier)
  );
}

// Specialized hook for user-related events (combines profile, posts, reactions)
export function useUserRelatedEvents(
  pubkey: string,
  options: Partial<EventBatchOptions> = {}
) {
  return useEventBatch(
    ['user-related', pubkey],
    {
      kinds: [0, 1, 7, 9411], // Profile, posts, reactions, channel messages
      authors: [pubkey],
      limit: 100,
      staleTime: 2 * 60 * 1000, // 2 minutes
      ...options,
    },
    !!pubkey
  );
}

// Helper functions to extract specific event types from batched results
export function extractEventsByKind(events: NostrEvent[], kind: number): NostrEvent[] {
  return events.filter(event => event.kind === kind);
}

export function extractMessageEvents(events: NostrEvent[], channelId?: string): NostrEvent[] {
  const messageEvents = events.filter(event => [1, 9411].includes(event.kind));

  if (!channelId) return messageEvents;

  return messageEvents.filter(event => {
    // For kind 9411, check channel tag
    if (event.kind === 9411) {
      const eventChannelId = event.tags.find(([name]) => name === 't')?.[1];
      return eventChannelId === channelId;
    }

    // For kind 1, allow if no channel tag (legacy) or matching channel tag
    if (event.kind === 1) {
      const eventChannelId = event.tags.find(([name]) => name === 't')?.[1];
      if (!eventChannelId && channelId === 'general') return true;
      return eventChannelId === channelId;
    }

    return false;
  });
}

export function extractReactionEvents(events: NostrEvent[], targetEventId?: string): NostrEvent[] {
  const reactions = events.filter(event => event.kind === 7);

  if (!targetEventId) return reactions;

  return reactions.filter(event =>
    event.tags.some(([name, value]) => name === 'e' && value === targetEventId)
  );
}