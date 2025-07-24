import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useEventCache } from './useEventCache';
import type { NostrFilter, NostrEvent } from '@nostrify/nostrify';
import type { Channel } from './useChannels';

const PRELOAD_DELAY = 200; // Wait 200ms before preloading (hover intent)
const PRELOAD_CACHE_TIME = 10 * 60 * 1000; // 10 minutes cache for preloaded channels
const BATCH_SIZE = 5; // Load channels for up to 5 communities at once

/**
 * Hook for preloading channel data on hover or other user interactions.
 * This provides instant loading when users navigate to communities.
 */
export function useChannelPreloader() {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { cacheEvents } = useEventCache();

  const preloadTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const preloadedCommunities = useRef<Set<string>>(new Set());
  const batchQueue = useRef<string[]>([]);
  const batchTimeout = useRef<NodeJS.Timeout>();

  // Check if channel data is already cached and fresh
  const isChannelDataFresh = useCallback((communityId: string): boolean => {
    const channelsQuery = queryClient.getQueryState(['channels', communityId]);
    const foldersQuery = queryClient.getQueryState(['channel-folders', communityId]);

    const now = Date.now();
    const isChannelsFresh = channelsQuery?.dataUpdatedAt &&
                           (now - channelsQuery.dataUpdatedAt) < PRELOAD_CACHE_TIME;
    const isFoldersFresh = foldersQuery?.dataUpdatedAt &&
                          (now - foldersQuery.dataUpdatedAt) < PRELOAD_CACHE_TIME;

    return !!(isChannelsFresh && isFoldersFresh);
  }, [queryClient]);

  // Validate channel event
  const validateChannelEvent = useCallback((event: NostrEvent): boolean => {
    if (event.kind !== 32807) return false;

    const d = event.tags.find(([name]) => name === 'd')?.[1];
    const communityRef = event.tags.find(([name]) => name === 'a')?.[1];

    if (!d || !communityRef) return false;

    try {
      const content = JSON.parse(event.content);
      if (!content.name || !['text', 'voice'].includes(content.type)) {
        return false;
      }
    } catch {
      return false;
    }

    return true;
  }, []);

  // Parse channel event into Channel object
  const parseChannelEvent = useCallback((event: NostrEvent, communityId: string): Channel => {
    const d = event.tags.find(([name]) => name === 'd')?.[1] || '';
    const name = event.tags.find(([name]) => name === 'name')?.[1] || '';
    const description = event.tags.find(([name]) => name === 'description')?.[1];
    const channelType = event.tags.find(([name]) => name === 'channel_type')?.[1] as 'text' | 'voice' || 'text';
    const folderId = event.tags.find(([name]) => name === 'folder')?.[1];
    const position = parseInt(event.tags.find(([name]) => name === 'position')?.[1] || '0');

    let content: { name: string; type: 'text' | 'voice'; folderId?: string; position?: number; description?: string };
    try {
      content = JSON.parse(event.content);
    } catch {
      content = { name, type: channelType };
    }

    return {
      id: d || `${communityId}:${name}`,
      name: content.name || name,
      description: content.description || description,
      type: content.type || channelType,
      communityId,
      creator: event.pubkey,
      folderId: content.folderId || folderId,
      position: content.position || position,
      event,
    };
  }, []);

  // Preload channels for a batch of communities
  const preloadChannelsBatch = useCallback(async (communityIds: string[]): Promise<void> => {
    if (communityIds.length === 0) return;

    try {
      // Create batched filters for efficient querying
      const filters: NostrFilter[] = [];

      for (const communityId of communityIds) {
        // Channel definition events
        filters.push({
          kinds: [32807],
          '#a': [communityId],
          '#t': ['channel'],
          limit: 50, // Reasonable limit per community
        });

        // Channel folder events (if using a specific kind for folders)
        filters.push({
          kinds: [32808], // Assuming folder events use kind 32808
          '#a': [communityId],
          '#t': ['folder'],
          limit: 20,
        });
      }

      if (filters.length === 0) return;

      // Execute batched query with timeout
      const signal = AbortSignal.timeout(4000); // 4 second timeout for preloading
      const events = await nostr.query(filters, { signal });

      if (events.length > 0) {
        // Cache the events
        cacheEvents(events);

        // Process events for each community
        for (const communityId of communityIds) {
          const communityEvents = events.filter(event => {
            const communityRef = event.tags.find(([name]) => name === 'a')?.[1];
            return communityRef === communityId;
          });

          if (communityEvents.length > 0) {
            // Process channel events
            const channelEvents = communityEvents.filter(event => event.kind === 32807);
            const validChannelEvents = channelEvents.filter(validateChannelEvent);
            const customChannels = validChannelEvents.map(event => parseChannelEvent(event, communityId));

            // Always include the default "general" channel
            const defaultChannels: Channel[] = [
              {
                id: 'general',
                name: 'general',
                description: 'General discussion',
                type: 'text',
                communityId,
                creator: '',
                position: 0,
                event: {} as NostrEvent,
              },
            ];

            // Combine default and custom channels, avoiding duplicates
            const allChannels = [...defaultChannels];
            customChannels.forEach(customChannel => {
              const isDuplicate = allChannels.some(existing =>
                existing.name.toLowerCase() === customChannel.name.toLowerCase()
              );
              if (!isDuplicate) {
                allChannels.push(customChannel);
              }
            });

            // Sort channels
            const sortedChannels = allChannels.sort((a, b) => {
              if (a.folderId !== b.folderId) {
                if (!a.folderId) return -1;
                if (!b.folderId) return 1;
                return a.folderId.localeCompare(b.folderId);
              }
              if (a.position !== b.position) {
                return a.position - b.position;
              }
              if (a.type !== b.type) {
                return a.type === 'text' ? -1 : 1;
              }
              return a.name.localeCompare(b.name);
            });

            // Cache channels
            queryClient.setQueryData(
              ['channels', communityId],
              sortedChannels,
              {
                updatedAt: Date.now(),
              }
            );

            // Process folder events (simplified - you may need to adjust based on your folder structure)
            const folderEvents = communityEvents.filter(event => event.kind === 32808);
            if (folderEvents.length > 0) {
              const folders = folderEvents.map(event => ({
                id: event.tags.find(([name]) => name === 'd')?.[1] || '',
                name: event.tags.find(([name]) => name === 'name')?.[1] || '',
                description: event.tags.find(([name]) => name === 'description')?.[1],
                position: parseInt(event.tags.find(([name]) => name === 'position')?.[1] || '0'),
                event,
              }));

              queryClient.setQueryData(
                ['channel-folders', communityId],
                folders,
                {
                  updatedAt: Date.now(),
                }
              );
            }

            // Mark community as preloaded
            preloadedCommunities.current.add(communityId);
          }
        }

        console.log(`Preloaded channels for ${communityIds.length} communities: ${events.length} events`);
      }
    } catch (error) {
      // Silently handle preload errors
      console.warn(`Channel preload failed for communities:`, communityIds, error);
    }
  }, [nostr, cacheEvents, queryClient, validateChannelEvent, parseChannelEvent]);

  // Process batch queue
  const processBatchQueue = useCallback(() => {
    if (batchQueue.current.length === 0) return;

    const batch = batchQueue.current.splice(0, BATCH_SIZE);
    preloadChannelsBatch(batch);

    // Schedule next batch if queue is not empty
    if (batchQueue.current.length > 0) {
      batchTimeout.current = setTimeout(processBatchQueue, 500); // 500ms between batches
    }
  }, [preloadChannelsBatch]);

  // Add community to batch queue
  const addToBatchQueue = useCallback((communityId: string) => {
    // Skip if already preloaded recently or data is fresh
    if (preloadedCommunities.current.has(communityId) || isChannelDataFresh(communityId)) {
      return;
    }

    // Add to queue if not already there
    if (!batchQueue.current.includes(communityId)) {
      batchQueue.current.push(communityId);
    }

    // Clear existing batch timeout
    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
    }

    // Schedule batch processing
    batchTimeout.current = setTimeout(processBatchQueue, 100); // Quick batch processing
  }, [isChannelDataFresh, processBatchQueue]);

  // Start preloading with delay (hover intent detection)
  const startPreload = useCallback((communityId: string) => {
    // Clear any existing timeout for this community
    const existingTimeout = preloadTimeouts.current.get(communityId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      addToBatchQueue(communityId);
      preloadTimeouts.current.delete(communityId);
    }, PRELOAD_DELAY);

    preloadTimeouts.current.set(communityId, timeout);
  }, [addToBatchQueue]);

  // Cancel preloading (user moved away)
  const cancelPreload = useCallback((communityId: string) => {
    const timeout = preloadTimeouts.current.get(communityId);
    if (timeout) {
      clearTimeout(timeout);
      preloadTimeouts.current.delete(communityId);
    }

    // Remove from batch queue
    const index = batchQueue.current.indexOf(communityId);
    if (index > -1) {
      batchQueue.current.splice(index, 1);
    }
  }, []);

  // Immediate preload (for high-priority scenarios)
  const preloadImmediately = useCallback((communityId: string) => {
    // Cancel any delayed preload
    cancelPreload(communityId);
    // Add to batch queue immediately
    addToBatchQueue(communityId);
  }, [cancelPreload, addToBatchQueue]);

  // Preload multiple communities at once
  const preloadMultiple = useCallback((communityIds: string[]) => {
    const filteredIds = communityIds.filter(id =>
      !preloadedCommunities.current.has(id) && !isChannelDataFresh(id)
    );

    if (filteredIds.length > 0) {
      preloadChannelsBatch(filteredIds);
    }
  }, [isChannelDataFresh, preloadChannelsBatch]);

  // Clear preload cache
  const clearPreloadCache = useCallback(() => {
    preloadedCommunities.current.clear();
    batchQueue.current = [];

    // Clear all pending timeouts
    preloadTimeouts.current.forEach(timeout => clearTimeout(timeout));
    preloadTimeouts.current.clear();

    if (batchTimeout.current) {
      clearTimeout(batchTimeout.current);
    }
  }, []);

  // Get preload statistics
  const getPreloadStats = useCallback(() => {
    return {
      preloadedCount: preloadedCommunities.current.size,
      pendingCount: preloadTimeouts.current.size,
      queueLength: batchQueue.current.length,
      preloadedCommunities: Array.from(preloadedCommunities.current),
    };
  }, []);

  return {
    startPreload,
    cancelPreload,
    preloadImmediately,
    preloadMultiple,
    clearPreloadCache,
    getPreloadStats,
  };
}