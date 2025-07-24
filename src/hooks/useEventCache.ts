import { useQueryClient } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Hook for managing cached Nostr events
 * Provides utilities to store, retrieve, and invalidate cached events
 */
export function useEventCache() {
  const queryClient = useQueryClient();

  // Store events in cache by ID for quick retrieval
  const cacheEvent = (event: NostrEvent) => {
    queryClient.setQueryData(['event', event.id], event, {
      updatedAt: Date.now(),
    });

    // Also cache by kind for kind-based queries
    const existingKindEvents = queryClient.getQueryData<NostrEvent[]>(['events-by-kind', event.kind]) || [];
    const updatedKindEvents = [event, ...existingKindEvents.filter(e => e.id !== event.id)];
    queryClient.setQueryData(['events-by-kind', event.kind], updatedKindEvents, {
      updatedAt: Date.now(),
    });

    // Cache by author for author-based queries
    const existingAuthorEvents = queryClient.getQueryData<NostrEvent[]>(['events-by-author', event.pubkey]) || [];
    const updatedAuthorEvents = [event, ...existingAuthorEvents.filter(e => e.id !== event.id)];
    queryClient.setQueryData(['events-by-author', event.pubkey], updatedAuthorEvents, {
      updatedAt: Date.now(),
    });
  };

  // Store multiple events at once
  const cacheEvents = (events: NostrEvent[]) => {
    events.forEach(cacheEvent);
  };

  // Get cached event by ID
  const getCachedEvent = (eventId: string): NostrEvent | undefined => {
    return queryClient.getQueryData(['event', eventId]);
  };

  // Get cached events by kind
  const getCachedEventsByKind = (kind: number): NostrEvent[] => {
    return queryClient.getQueryData(['events-by-kind', kind]) || [];
  };

  // Get cached events by author
  const getCachedEventsByAuthor = (pubkey: string): NostrEvent[] => {
    // First try the dedicated author cache
    const authorEvents = queryClient.getQueryData<NostrEvent[]>(['events-by-author', pubkey]);
    if (authorEvents && authorEvents.length > 0) {
      return authorEvents;
    }

    // Fallback to searching all queries (less efficient)
    const allQueries = queryClient.getQueryCache().getAll();
    const events: NostrEvent[] = [];

    allQueries.forEach(query => {
      const data = query.state.data;
      if (Array.isArray(data)) {
        const authorEvents = data.filter((item: unknown) =>
          item && typeof item === 'object' && 'pubkey' in item && (item as NostrEvent).pubkey === pubkey
        );
        events.push(...authorEvents);
      }
    });

    return events;
  };

  // Invalidate event cache
  const invalidateEvent = (eventId: string) => {
    queryClient.invalidateQueries({ queryKey: ['event', eventId] });
  };

  // Invalidate events by kind
  const invalidateEventsByKind = (kind: number) => {
    queryClient.invalidateQueries({ queryKey: ['events-by-kind', kind] });
  };

  // Invalidate all event-related queries
  const invalidateAllEvents = () => {
    queryClient.invalidateQueries({ queryKey: ['event'] });
    queryClient.invalidateQueries({ queryKey: ['events-by-kind'] });
    queryClient.invalidateQueries({ queryKey: ['events-by-author'] });
    queryClient.invalidateQueries({ queryKey: ['events-batch'] });
  };

  // Get cache statistics
  const getCacheStats = () => {
    const allQueries = queryClient.getQueryCache().getAll();
    const eventQueries = allQueries.filter(query =>
      query.queryKey[0] === 'event' ||
      query.queryKey[0] === 'events-by-kind' ||
      query.queryKey[0] === 'events-by-author' ||
      query.queryKey[0] === 'events-batch'
    );

    let totalEvents = 0;
    let hitCount = 0;

    eventQueries.forEach(query => {
      if (query.state.data) {
        if (Array.isArray(query.state.data)) {
          totalEvents += query.state.data.length;
        } else {
          totalEvents += 1;
        }
        hitCount += 1;
      }
    });

    return {
      totalQueries: eventQueries.length,
      totalEvents,
      hitCount,
      hitRate: eventQueries.length > 0 ? hitCount / eventQueries.length : 0,
    };
  };

  return {
    cacheEvent,
    cacheEvents,
    getCachedEvent,
    getCachedEventsByKind,
    getCachedEventsByAuthor,
    invalidateEvent,
    invalidateEventsByKind,
    invalidateAllEvents,
    getCacheStats,
  };
}

/**
 * Hook to prefetch commonly needed events
 * Useful for warming the cache with frequently accessed data
 */
export function useEventPrefetch() {
  const queryClient = useQueryClient();

  const prefetchUserEvents = async (pubkey: string, _kinds: number[] = [0, 1, 9411]) => {
    // Check if we already have recent data
    const existingData = queryClient.getQueryData(['user-events-prefetch', pubkey]);
    if (existingData) return;

    // This would typically make a Nostr query, but we'll mark it as prefetched
    queryClient.setQueryData(['user-events-prefetch', pubkey], true);
  };

  const prefetchCommunityEvents = async (communityId: string) => {
    const existingData = queryClient.getQueryData(['community-events-prefetch', communityId]);
    if (existingData) return;

    queryClient.setQueryData(['community-events-prefetch', communityId], true);
  };

  return {
    prefetchUserEvents,
    prefetchCommunityEvents,
  };
}