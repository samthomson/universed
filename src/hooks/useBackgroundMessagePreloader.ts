import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCallback, useMemo } from 'react';
import { logger } from '@/lib/logger';
import type { NostrEvent, NostrFilter, NPool } from '@nostrify/nostrify';

function buildBackgroundFilters(kind: string, pubkey: string, identifier: string, channelId: string): NostrFilter[] {
  const filters: NostrFilter[] = [];

  if (channelId === 'general') {
    // For general channel, query both kinds in one filter
    filters.push({
      kinds: [1, 9411], // Combined kinds for efficiency
      '#a': [`${kind}:${pubkey}:${identifier}`], // Community reference
      limit: 50, // Smaller limit for background loading
    });
  } else {
    // For specific channels, only query kind 9411 with channel tag
    filters.push({
      kinds: [9411],
      '#t': [channelId], // Channel identifier
      '#a': [`${kind}:${pubkey}:${identifier}`], // Community reference
      limit: 30, // Smaller limit for background loading
    });
  }

  return filters;
}

export function validateBackgroundMessageEvent(event: NostrEvent, expectedChannelId: string): boolean {
  // Same validation as useMessages but without access checks
  return (
    // Check kind first (fastest check)
    ([1, 9411].includes(event.kind)) &&
    // Check for e-tags in one operation (no replies in main feed)
    (!event.tags.some(([name]) => name === 'e')) &&
    // Check channel tag only once with appropriate logic for each kind
    ((event.kind === 9411 && event.tags.some(([name, value]) => name === 't' && value === expectedChannelId)) ||
     (event.kind === 1 && (
       (expectedChannelId === 'general' && !event.tags.some(([name]) => name === 't')) ||
       event.tags.some(([name, value]) => name === 't' && value === expectedChannelId)
     )))
  );
}

// Export the queryFn for explicit reuse
export async function fetchBackgroundMessages(
  communityId: string, 
  channelId: string, 
  nostr: NPool, 
  signal?: AbortSignal
): Promise<NostrEvent[]> {
  const [kind, pubkey, identifier] = communityId.split(':');
  if (!kind || !pubkey || !identifier) return [];

  const filters = buildBackgroundFilters(kind, pubkey, identifier, channelId);
  const events = await nostr.query(filters, { signal });

  const validEvents = events.filter(event => validateBackgroundMessageEvent(event, channelId));
  return validEvents.sort((a, b) => a.created_at - b.created_at);
}

/**
 * Hook for background preloading of community messages.
 * This bypasses permission checks and loads messages for preview purposes.
 */
export function useBackgroundMessagePreloader(communityId: string | null, channelId: string | null) {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  
  const queryKey = useMemo(() => ['background-messages', communityId, channelId], [communityId, channelId]);

  // Background query for messages (bypasses permission checks)
  const query = useQuery({
    queryKey,
    queryFn: async (c) => {
      if (!communityId || !channelId) return [];
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]); // Shorter timeout for background
      return fetchBackgroundMessages(communityId, channelId, nostr, signal);
    },
    enabled: !!communityId && !!channelId,
    refetchInterval: false,
    staleTime: 1000 * 60 * 5, // 5 minutes stale time for background data
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
    retry: 1, // Only retry once for background loading
  });

  // Function to manually trigger background preloading
  const preloadMessages = useCallback(async (targetCommunityId: string, targetChannelId: string) => {
    if (!targetCommunityId || !targetChannelId) return;

    const targetQueryKey = ['background-messages', targetCommunityId, targetChannelId];
    
    // Check if already cached
    const cachedData = queryClient.getQueryData<NostrEvent[]>(targetQueryKey);
    if (cachedData && cachedData.length > 0) {
      logger.log(`[BackgroundPreloader] Using cached messages for ${targetCommunityId}:${targetChannelId}`);
      return cachedData;
    }

    // Fetch fresh data
    try {
      logger.log(`[BackgroundPreloader] Preloading messages for ${targetCommunityId}:${targetChannelId}`);
      const signal = AbortSignal.timeout(3000);
      const messages = await fetchBackgroundMessages(targetCommunityId, targetChannelId, nostr, signal);
      
      if (messages.length > 0) {
        queryClient.setQueryData(targetQueryKey, messages);
        logger.log(`[BackgroundPreloader] Preloaded ${messages.length} messages for ${targetCommunityId}:${targetChannelId}`);
      }
      
      return messages;
    } catch (error) {
      logger.warn(`[BackgroundPreloader] Failed to preload messages for ${targetCommunityId}:${targetChannelId}:`, error);
      return [];
    }
  }, [nostr, queryClient]);

  // Function to get preloaded messages for a specific community/channel
  const getPreloadedMessages = useCallback((targetCommunityId: string, targetChannelId: string) => {
    const targetQueryKey = ['background-messages', targetCommunityId, targetChannelId];
    return queryClient.getQueryData<NostrEvent[]>(targetQueryKey) || [];
  }, [queryClient]);

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    preloadMessages,
    getPreloadedMessages,
  };
}