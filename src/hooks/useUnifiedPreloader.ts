import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useEventCache } from './useEventCache';
import { fetchMessages } from './useMessages';
import { useChannelPreloader } from './useChannelPreloader';
import { useSpacesPreloader } from './useSpacesPreloader';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Unified preloader for all types of content
 * Provides simple, immediate preloading for different interaction types
 */
export function useUnifiedPreloader() {
  const queryClient = useQueryClient();
  const { nostr } = useNostr();
  const { cacheEvents } = useEventCache();
  const { preloadImmediately: preloadChannelDefinitions } = useChannelPreloader();
  const { preloadImmediately: preloadSpaceDefinitions } = useSpacesPreloader();

  // Check if data is already cached and fresh
  const isDataFresh = useCallback((queryKey: (string | number | boolean)[]): boolean => {
    const queryState = queryClient.getQueryState(queryKey);
    if (!queryState?.dataUpdatedAt) return false;

    const age = Date.now() - queryState.dataUpdatedAt;
    return age < CACHE_DURATION;
  }, [queryClient]);

  // Preload channel messages
  const preloadChannelMessages = useCallback((communityId: string, channelId: string) => {
    const queryKey = ['messages', communityId, channelId];
    
    if (!isDataFresh(queryKey)) {
      queryClient.prefetchQuery({
        queryKey,
        queryFn: async ({ signal }) => {
          return fetchMessages(communityId, channelId, nostr, cacheEvents, signal);
        },
        staleTime: CACHE_DURATION,
      });
    }
  }, [queryClient, isDataFresh, nostr, cacheEvents]);

  // Preload community data (channels + default channel messages)
  const preloadCommunity = useCallback((communityId: string) => {
    // Preload channel definitions
    preloadChannelDefinitions(communityId);
    
    // Preload default channel messages (usually "general")
    preloadChannelMessages(communityId, 'general');
  }, [preloadChannelDefinitions, preloadChannelMessages]);

  // Preload space definitions
  const preloadSpaces = useCallback((communityId: string) => {
    preloadSpaceDefinitions(communityId);
  }, [preloadSpaceDefinitions]);

  // Preload space-specific content (marketplace items, resource folders, etc.)
  const preloadSpaceContent = useCallback((communityId: string, spaceId: string) => {
    if (spaceId === 'marketplace') {
      const queryKey = ['marketplace-items', communityId];
      if (!isDataFresh(queryKey)) {
        queryClient.prefetchQuery({
          queryKey,
          staleTime: CACHE_DURATION,
        });
      }
    } else if (spaceId === 'resources') {
      const queryKey = ['resource-folders', communityId];
      if (!isDataFresh(queryKey)) {
        queryClient.prefetchQuery({
          queryKey,
          staleTime: CACHE_DURATION,
        });
      }
    }
  }, [queryClient, isDataFresh]);

  // Complete community preload (channels + spaces + general messages)
  const preloadCommunityComplete = useCallback((communityId: string) => {
    preloadCommunity(communityId);
    preloadSpaces(communityId);
  }, [preloadCommunity, preloadSpaces]);

  return {
    // Individual preloaders
    preloadChannelMessages,
    preloadCommunity,
    preloadSpaces,
    preloadSpaceContent,
    
    // Combined preloaders
    preloadCommunityComplete,
    
    // Utility
    isDataFresh,
  };
}