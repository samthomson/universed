import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useEventCache } from './useEventCache';
import { fetchMessages } from './useMessages';
import { logger } from '@/lib/logger';

/**
 * Hook for preloading community data on hover/mousedown.
 * Preloads channels list and general channel messages to provide instant navigation.
 */
export function usePreloadCommunity() {
  const queryClient = useQueryClient();
  const { nostr } = useNostr();
  const { cacheEvents } = useEventCache();

  const preloadCommunity = useCallback(async (communityId: string, selectedCommunity?: string) => {
    // Skip if already selected
    if (communityId === selectedCommunity) {
      logger.log('[DEBUG PRELOAD] Skipping preload - community already selected:', communityId);
      return;
    }

    logger.log('[DEBUG PRELOAD] Starting community preload:', communityId);

    try {
      // Check if data is already cached and fresh (5 minutes)
      const CACHE_DURATION = 5 * 60 * 1000;
      const channelsQueryKey = ['channels', communityId];
      // Use the exact same query key structure as useMessages: ['messages', communityId, channelId, approvedMembers?.size]
      // Most communities don't require approval, so approvedMembers will be null (no filtering)
      // This is the most common case and what we should preload for
      const messagesQueryKey = ['messages', communityId, 'general', null];
      
      const channelsState = queryClient.getQueryState(channelsQueryKey);
      const messagesState = queryClient.getQueryState(messagesQueryKey);
      
      const now = Date.now();
      const isChannelsFresh = channelsState?.dataUpdatedAt && (now - channelsState.dataUpdatedAt) < CACHE_DURATION;
      const isMessagesFresh = messagesState?.dataUpdatedAt && (now - messagesState.dataUpdatedAt) < CACHE_DURATION;

      logger.log('[DEBUG PRELOAD] Cache status:', {
        communityId,
        channels: { fresh: isChannelsFresh, lastUpdate: channelsState?.dataUpdatedAt ? new Date(channelsState.dataUpdatedAt).toISOString() : 'never' },
        messages: { fresh: isMessagesFresh, lastUpdate: messagesState?.dataUpdatedAt ? new Date(messagesState.dataUpdatedAt).toISOString() : 'never' }
      });

      // Preload channels if not fresh - uses EXACT same query as useChannels
      if (!isChannelsFresh) {
        logger.log('[DEBUG PRELOAD] Prefetching channels for:', communityId);
        queryClient.prefetchQuery({
          queryKey: channelsQueryKey,
          staleTime: CACHE_DURATION,
        });
      } else {
        logger.log('[DEBUG PRELOAD] Channels already fresh for:', communityId);
      }

      // Preload general channel messages if not fresh - uses EXACT same query as useMessages
      if (!isMessagesFresh) {
        logger.log('[DEBUG PRELOAD] Prefetching general messages for:', communityId);
        queryClient.prefetchQuery({
          queryKey: messagesQueryKey,
          queryFn: async ({ signal }) => {
            logger.log('[DEBUG PRELOAD] Executing fetchMessages query for general channel:', communityId);
            const result = await fetchMessages(communityId, 'general', nostr, cacheEvents, signal, null);
            logger.log('[DEBUG PRELOAD] Fetched', result.events.length, 'messages for general channel:', communityId);
            return result.events;
          },
          staleTime: CACHE_DURATION,
        });
      } else {
        logger.log('[DEBUG PRELOAD] General messages already fresh for:', communityId);
      }

      logger.log('[DEBUG PRELOAD] Community preload completed:', communityId);
    } catch (error) {
      // Silently handle preload errors
      logger.log('[DEBUG PRELOAD] Community preload failed:', communityId, error);
    }
  }, [queryClient, nostr, cacheEvents]);

  return { preloadCommunity };
}
