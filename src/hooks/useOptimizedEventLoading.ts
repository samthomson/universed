import { useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useEventCache } from './useEventCache';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';

interface LoadingBatch {
  communityId: string;
  eventIds: string[];
  timestamp: number;
}

const BATCH_DELAY = 500; // Wait 500ms to collect more requests
const BATCH_SIZE = 20; // Maximum event IDs per batch
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache for reactions/comments

/**
 * Hook that optimizes loading of related events (reactions, comments, etc.)
 * by batching requests and utilizing cache effectively.
 */
export function useOptimizedEventLoading() {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { cacheEvents, getCachedEvent } = useEventCache();
  
  const batchQueue = useRef<Map<string, LoadingBatch>>(new Map());
  const batchTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const loadingPromises = useRef<Map<string, Promise<NostrEvent[]>>>(new Map());

  // Process a batch of event loading requests
  const processBatch = useCallback(async (communityId: string, eventIds: string[]): Promise<NostrEvent[]> => {
    if (eventIds.length === 0) return [];

    try {
      // Check cache first for each event
      const cachedEvents: NostrEvent[] = [];
      const uncachedEventIds: string[] = [];

      eventIds.forEach(eventId => {
        const cached = getCachedEvent(eventId);
        if (cached) {
          cachedEvents.push(cached);
        } else {
          uncachedEventIds.push(eventId);
        }
      });

      // If all events are cached, return them
      if (uncachedEventIds.length === 0) {
        return cachedEvents;
      }

      // Create efficient batched query for uncached events
      const filters: NostrFilter[] = [
        // Reactions to the events
        {
          kinds: [7],
          '#e': uncachedEventIds,
          limit: 100,
        },
        // Comments/replies to the events
        {
          kinds: [1111],
          '#e': uncachedEventIds,
          limit: 50,
        },
        // Thread replies (kind 1 with e tags)
        {
          kinds: [1],
          '#e': uncachedEventIds,
          limit: 30,
        }
      ];

      const signal = AbortSignal.timeout(5000);
      const events = await nostr.query(filters, { signal });

      // Cache all fetched events
      if (events.length > 0) {
        cacheEvents(events);

        // Also cache individual event queries
        events.forEach(event => {
          queryClient.setQueryData(['event', event.id], event, {
            updatedAt: Date.now(),
          });
        });
      }

      // Combine cached and fresh events
      const allEvents = [...cachedEvents, ...events];

      // Cache the combined result for this batch
      const cacheKey = ['event-batch', communityId, eventIds.sort().join(',')];
      queryClient.setQueryData(cacheKey, allEvents, {
        updatedAt: Date.now(),
      });

      return allEvents;
    } catch (error) {
      console.warn('Batch event loading failed:', error);
      return [];
    }
  }, [nostr, cacheEvents, getCachedEvent, queryClient]);

  // Execute batched loading for a community
  const executeBatch = useCallback(async (communityId: string) => {
    const batch = batchQueue.current.get(communityId);
    if (!batch) return;

    // Clear the batch and timeout
    batchQueue.current.delete(communityId);
    const timeout = batchTimeouts.current.get(communityId);
    if (timeout) {
      clearTimeout(timeout);
      batchTimeouts.current.delete(communityId);
    }

    // Check if we already have a loading promise for this exact batch
    const batchKey = `${communityId}:${batch.eventIds.sort().join(',')}`;
    const existingPromise = loadingPromises.current.get(batchKey);
    if (existingPromise) {
      return existingPromise;
    }

    // Create and cache the loading promise
    const promise = processBatch(communityId, batch.eventIds);
    loadingPromises.current.set(batchKey, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      // Clean up the promise after completion
      loadingPromises.current.delete(batchKey);
    }
  }, [processBatch]);

  // Add event IDs to the loading batch
  const addToBatch = useCallback((communityId: string, eventIds: string[]) => {
    if (eventIds.length === 0) return;

    const existingBatch = batchQueue.current.get(communityId);
    const now = Date.now();

    if (existingBatch) {
      // Add to existing batch
      const uniqueEventIds = [...new Set([...existingBatch.eventIds, ...eventIds])];
      existingBatch.eventIds = uniqueEventIds.slice(0, BATCH_SIZE); // Limit batch size
      existingBatch.timestamp = now;
    } else {
      // Create new batch
      batchQueue.current.set(communityId, {
        communityId,
        eventIds: eventIds.slice(0, BATCH_SIZE),
        timestamp: now,
      });
    }

    // Clear existing timeout and set new one
    const existingTimeout = batchTimeouts.current.get(communityId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      executeBatch(communityId);
    }, BATCH_DELAY);

    batchTimeouts.current.set(communityId, timeout);
  }, [executeBatch]);

  // Load reactions for specific events
  const loadReactions = useCallback(async (communityId: string, eventIds: string[]): Promise<NostrEvent[]> => {
    // Check cache first
    const cacheKey = ['reactions-batch', communityId, eventIds.sort().join(',')];
    const cached = queryClient.getQueryData<NostrEvent[]>(cacheKey);
    const cacheState = queryClient.getQueryState(cacheKey);
    
    if (cached && cacheState?.dataUpdatedAt && 
        (Date.now() - cacheState.dataUpdatedAt) < CACHE_DURATION) {
      return cached;
    }

    // Add to batch for loading
    addToBatch(communityId, eventIds);

    // Wait for batch to complete
    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY + 100));

    // Return cached result
    return queryClient.getQueryData<NostrEvent[]>(cacheKey) || [];
  }, [queryClient, addToBatch]);

  // Load comments for specific events
  const loadComments = useCallback(async (communityId: string, eventIds: string[]): Promise<NostrEvent[]> => {
    const cacheKey = ['comments-batch', communityId, eventIds.sort().join(',')];
    const cached = queryClient.getQueryData<NostrEvent[]>(cacheKey);
    const cacheState = queryClient.getQueryState(cacheKey);
    
    if (cached && cacheState?.dataUpdatedAt && 
        (Date.now() - cacheState.dataUpdatedAt) < CACHE_DURATION) {
      return cached;
    }

    addToBatch(communityId, eventIds);
    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY + 100));
    
    return queryClient.getQueryData<NostrEvent[]>(cacheKey) || [];
  }, [queryClient, addToBatch]);

  // Preload related events for a list of message events
  const preloadRelatedEvents = useCallback((communityId: string, messageEvents: NostrEvent[]) => {
    const eventIds = messageEvents.map(event => event.id);
    if (eventIds.length > 0) {
      addToBatch(communityId, eventIds);
    }
  }, [addToBatch]);

  // Clear all batches and timeouts
  const clearBatches = useCallback(() => {
    batchQueue.current.clear();
    batchTimeouts.current.forEach(timeout => clearTimeout(timeout));
    batchTimeouts.current.clear();
    loadingPromises.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearBatches();
    };
  }, [clearBatches]);

  return {
    loadReactions,
    loadComments,
    preloadRelatedEvents,
    clearBatches,
  };
}