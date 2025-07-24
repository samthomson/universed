import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useEventCache } from './useEventCache';
import type { NostrFilter, NostrEvent } from '@nostrify/nostrify';
import type { Space } from './useSpaces';

const PRELOAD_DELAY = 200; // Wait 200ms before preloading (hover intent)
const PRELOAD_CACHE_TIME = 10 * 60 * 1000; // 10 minutes cache for preloaded spaces
const BATCH_SIZE = 5; // Load spaces for up to 5 communities at once

// Default spaces that come with every community
const DEFAULT_SPACES: Omit<Space, 'communityId' | 'creator' | 'event'>[] = [
  {
    id: 'marketplace',
    name: 'Marketplace',
    description: 'Buy and sell goods with Bitcoin, Lightning, and Cashu',
    type: 'marketplace',
    icon: 'ShoppingBag',
    enabled: true,
    position: 0,
  },
  {
    id: 'resources',
    name: 'Resources',
    description: 'Organized collection of useful links and files',
    type: 'resources',
    icon: 'BookOpen',
    enabled: true,
    position: 1,
  },
];

/**
 * Hook for preloading spaces data on hover or other user interactions.
 * This provides instant loading when users navigate to communities.
 */
export function useSpacesPreloader() {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { cacheEvents } = useEventCache();

  const preloadTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const preloadedCommunities = useRef<Set<string>>(new Set());
  const batchQueue = useRef<string[]>([]);
  const batchTimeout = useRef<NodeJS.Timeout>();

  // Check if spaces data is already cached and fresh
  const isSpacesDataFresh = useCallback((communityId: string): boolean => {
    const spacesQuery = queryClient.getQueryState(['spaces', communityId]);
    const allSpacesQuery = queryClient.getQueryState(['all-spaces', communityId]);

    const now = Date.now();
    const isSpacesFresh = spacesQuery?.dataUpdatedAt &&
                         (now - spacesQuery.dataUpdatedAt) < PRELOAD_CACHE_TIME;
    const isAllSpacesFresh = allSpacesQuery?.dataUpdatedAt &&
                            (now - allSpacesQuery.dataUpdatedAt) < PRELOAD_CACHE_TIME;

    return !!(isSpacesFresh && isAllSpacesFresh);
  }, [queryClient]);

  // Validate space event
  const validateSpaceEvent = useCallback((event: NostrEvent): boolean => {
    if (event.kind !== 39097) return false;
    const d = event.tags.find(([name]) => name === 'd')?.[1];
    const communityRef = event.tags.find(([name]) => name === 'a')?.[1];
    if (!d || !communityRef) return false;
    try {
      const content = JSON.parse(event.content);
      if (!content.name || !['marketplace', 'resources', 'custom'].includes(content.type)) {
        return false;
      }
    } catch {
      return false;
    }
    return true;
  }, []);

  // Parse space event into Space object
  const parseSpaceEvent = useCallback((event: NostrEvent, communityId: string): Space => {
    const d = event.tags.find(([name]) => name === 'd')?.[1] || '';
    const name = event.tags.find(([name]) => name === 'name')?.[1] || '';
    const description = event.tags.find(([name]) => name === 'description')?.[1];
    const spaceType = event.tags.find(([name]) => name === 'space_type')?.[1] as 'marketplace' | 'resources' | 'custom' || 'custom';
    const icon = event.tags.find(([name]) => name === 'icon')?.[1] || 'Box';
    const enabled = event.tags.find(([name]) => name === 'enabled')?.[1] !== 'false';
    const position = parseInt(event.tags.find(([name]) => name === 'position')?.[1] || '999');

    let content: { name: string; type: 'marketplace' | 'resources' | 'custom'; icon: string; enabled: boolean; position: number; description?: string };
    try {
      content = JSON.parse(event.content);
    } catch {
      content = {
        name,
        type: spaceType,
        icon,
        enabled,
        position
      };
    }

    return {
      id: d || `${communityId}:${name}`,
      name: content.name || name,
      description: content.description || description,
      type: content.type || spaceType,
      icon: content.icon || icon,
      enabled: content.enabled !== undefined ? content.enabled : enabled,
      communityId,
      creator: event.pubkey,
      position: content.position || position,
      event,
    };
  }, []);

  // Preload spaces for a batch of communities
  const preloadSpacesBatch = useCallback(async (communityIds: string[]): Promise<void> => {
    if (communityIds.length === 0) return;

    try {
      // Create batched filters for efficient querying
      const filters: NostrFilter[] = [];

      for (const communityId of communityIds) {
        // Space configuration events
        filters.push({
          kinds: [39097],
          '#a': [communityId],
          '#t': ['space'],
          limit: 20, // Reasonable limit per community - spaces are typically few
        });
      }

      if (filters.length === 0) return;

      // Execute batched query with timeout
      const signal = AbortSignal.timeout(3000); // 3 second timeout for preloading
      const events = await nostr.query(filters, { signal });

      if (events.length > 0) {
        // Cache the events
        cacheEvents(events);
      }

      // Process events for each community (including those with no custom spaces)
      for (const communityId of communityIds) {
        const communityEvents = events.filter(event => {
          const communityRef = event.tags.find(([name]) => name === 'a')?.[1];
          return communityRef === communityId;
        });

        // Process space events
        const spaceEvents = communityEvents.filter(event => event.kind === 39097);
        const validSpaceEvents = spaceEvents.filter(validateSpaceEvent);
        const customSpaces = validSpaceEvents.map(event => parseSpaceEvent(event, communityId));

        // Start with default spaces
        const defaultSpaces: Space[] = DEFAULT_SPACES.map(space => ({
          ...space,
          communityId,
          creator: '',
          event: {} as NostrEvent,
        }));

        // Merge with custom configurations
        const allSpaces = [...defaultSpaces];

        // Apply custom configurations or add new custom spaces
        customSpaces.forEach(customSpace => {
          const existingIndex = allSpaces.findIndex(existing => existing.id === customSpace.id);
          if (existingIndex >= 0) {
            // Update existing space configuration
            allSpaces[existingIndex] = customSpace;
          } else {
            // Add new custom space
            allSpaces.push(customSpace);
          }
        });

        // Sort spaces
        const sortedSpaces = allSpaces.sort((a, b) => {
          if (a.position !== b.position) {
            return a.position - b.position;
          }
          return a.name.localeCompare(b.name);
        });

        // Cache enabled spaces
        const enabledSpaces = sortedSpaces.filter(space => space.enabled);
        queryClient.setQueryData(
          ['spaces', communityId],
          enabledSpaces,
          {
            updatedAt: Date.now(),
          }
        );

        // Cache all spaces (including disabled) for admin management
        queryClient.setQueryData(
          ['all-spaces', communityId],
          sortedSpaces,
          {
            updatedAt: Date.now(),
          }
        );

        // Mark community as preloaded
        preloadedCommunities.current.add(communityId);
      }

      console.log(`Preloaded spaces for ${communityIds.length} communities: ${events.length} events`);
    } catch (error) {
      // Silently handle preload errors but still cache defaults
      console.warn(`Spaces preload failed for communities:`, communityIds, error);
      
      // Cache default spaces for communities that failed
      for (const communityId of communityIds) {
        const defaultSpaces: Space[] = DEFAULT_SPACES.map(space => ({
          ...space,
          communityId,
          creator: '',
          event: {} as NostrEvent,
        }));

        queryClient.setQueryData(
          ['spaces', communityId],
          defaultSpaces,
          {
            updatedAt: Date.now(),
          }
        );

        queryClient.setQueryData(
          ['all-spaces', communityId],
          defaultSpaces,
          {
            updatedAt: Date.now(),
          }
        );
      }
    }
  }, [nostr, cacheEvents, queryClient, validateSpaceEvent, parseSpaceEvent]);

  // Process batch queue
  const processBatchQueue = useCallback(() => {
    if (batchQueue.current.length === 0) return;

    const batch = batchQueue.current.splice(0, BATCH_SIZE);
    preloadSpacesBatch(batch);

    // Schedule next batch if queue is not empty
    if (batchQueue.current.length > 0) {
      batchTimeout.current = setTimeout(processBatchQueue, 500); // 500ms between batches
    }
  }, [preloadSpacesBatch]);

  // Add community to batch queue
  const addToBatchQueue = useCallback((communityId: string) => {
    // Skip if already preloaded recently or data is fresh
    if (preloadedCommunities.current.has(communityId) || isSpacesDataFresh(communityId)) {
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
  }, [isSpacesDataFresh, processBatchQueue]);

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
      !preloadedCommunities.current.has(id) && !isSpacesDataFresh(id)
    );

    if (filteredIds.length > 0) {
      preloadSpacesBatch(filteredIds);
    }
  }, [isSpacesDataFresh, preloadSpacesBatch]);

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