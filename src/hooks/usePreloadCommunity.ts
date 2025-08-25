import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useEventCache } from './useEventCache';
import { fetchMessages } from './useMessages';
import { reactQueryConfigs } from '@/lib/reactQueryConfigs';

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
      return;
    }

    try {
      // Use the exact same query key structure as the actual hooks
      const channelsQueryKey = ['channels', communityId];
      // Use the exact same query key structure as useMessages: ['messages', communityId, channelId, approvedMembers?.size]
      // Most communities don't require approval, so approvedMembers will be null (no filtering)
      // This is the most common case and what we should preload for
      const messagesQueryKey = ['messages', communityId, 'general', null];
      
      const channelsState = queryClient.getQueryState(channelsQueryKey);
      const messagesState = queryClient.getQueryState(messagesQueryKey);
      
      const now = Date.now();
      const isChannelsFresh = channelsState?.dataUpdatedAt && (now - channelsState.dataUpdatedAt) < reactQueryConfigs.communities.staleTime;
      const isMessagesFresh = messagesState?.dataUpdatedAt && (now - messagesState.dataUpdatedAt) < reactQueryConfigs.messages.staleTime;



      // Preload channels if not fresh - uses EXACT same query as useChannels
      if (!isChannelsFresh) {
        queryClient.prefetchQuery({
          queryKey: channelsQueryKey,
          staleTime: reactQueryConfigs.communities.staleTime,
        });
      }

      // Preload general channel messages if not fresh - uses EXACT same query as useMessages
      if (!isMessagesFresh) {
        queryClient.prefetchQuery({
          queryKey: messagesQueryKey,
          queryFn: async ({ signal }) => {
            const result = await fetchMessages(communityId, 'general', nostr, cacheEvents, signal, null);
            return result.events;
          },
          staleTime: reactQueryConfigs.messages.staleTime,
        });
      }
    } catch {
      // Silently handle preload errors - no logging needed
    }
  }, [queryClient, nostr, cacheEvents]);

  return { preloadCommunity };
}
