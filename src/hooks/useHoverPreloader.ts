import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useStrategicBackgroundLoader } from './useStrategicBackgroundLoader';
import { useChannelPreloader } from './useChannelPreloader';
import { useSpacesPreloader } from './useSpacesPreloader';



const HOVER_INTENT_DELAY = 150; // 150ms to detect hover intent
const HOVER_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Hook that preloads data on hover to provide instant navigation
 */
export function useHoverPreloader() {
  const queryClient = useQueryClient();
  const { forceLoadCommunity } = useStrategicBackgroundLoader();
  const { startPreload: startChannelPreload, cancelPreload: cancelChannelPreload } = useChannelPreloader();
  const { startPreload: startSpacesPreload, cancelPreload: cancelSpacesPreload } = useSpacesPreloader();

  const hoverTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const hoverHistory = useRef<Map<string, number>>(new Map());

  // Check if data is already cached and fresh
  const isDataFresh = useCallback((queryKey: string[], maxAge: number = HOVER_CACHE_DURATION): boolean => {
    const queryState = queryClient.getQueryState(queryKey);
    if (!queryState?.dataUpdatedAt) return false;

    const age = Date.now() - queryState.dataUpdatedAt;
    return age < maxAge;
  }, [queryClient]);

  // Handle community hover
  const onCommunityHover = useCallback((communityId: string) => {
    // Clear any existing timeout for this community
    const existingTimeout = hoverTimeouts.current.get(`community:${communityId}`);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set hover intent detection timeout
    const timeout = setTimeout(async () => {
      // Check if we've recently preloaded this community
      const lastHover = hoverHistory.current.get(communityId);
      if (lastHover && (Date.now() - lastHover) < 60000) { // 1 minute cooldown
        return;
      }

      // Check if main data is already fresh
      const isMessagesFresh = isDataFresh(['messages', communityId, 'general']);
      const isChannelsFresh = isDataFresh(['channels', communityId]);
      const isSpacesFresh = isDataFresh(['spaces', communityId]);

      if (!isMessagesFresh || !isChannelsFresh || !isSpacesFresh) {
        // Start preloading
        startChannelPreload(communityId);
        startSpacesPreload(communityId);

        // If critical data is missing, force load immediately
        if (!isMessagesFresh) {
          forceLoadCommunity(communityId);
        }

        // Record hover time
        hoverHistory.current.set(communityId, Date.now());
      }

      // Clean up timeout reference
      hoverTimeouts.current.delete(`community:${communityId}`);
    }, HOVER_INTENT_DELAY);

    hoverTimeouts.current.set(`community:${communityId}`, timeout);
  }, [isDataFresh, startChannelPreload, startSpacesPreload, forceLoadCommunity]);

  // Handle community hover end
  const onCommunityHoverEnd = useCallback((communityId: string) => {
    // Cancel hover timeout if still pending
    const timeout = hoverTimeouts.current.get(`community:${communityId}`);
    if (timeout) {
      clearTimeout(timeout);
      hoverTimeouts.current.delete(`community:${communityId}`);
    }

    // Cancel any ongoing preloads
    cancelChannelPreload(communityId);
    cancelSpacesPreload(communityId);
  }, [cancelChannelPreload, cancelSpacesPreload]);

  // Note: Channel message preloading moved to useMessagePreloader (mousedown-based)
  // This provides better UX than hover-based preloading

  // Handle space hover
  const onSpaceHover = useCallback((communityId: string, spaceId: string) => {
    const key = `space:${communityId}:${spaceId}`;

    // Clear existing timeout
    const existingTimeout = hoverTimeouts.current.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set hover intent detection timeout
    const timeout = setTimeout(() => {
      // Prefetch space-specific data based on space type
      if (spaceId === 'marketplace') {
        queryClient.prefetchQuery({
          queryKey: ['marketplace-items', communityId],
          staleTime: 10 * 60 * 1000, // 10 minutes
        });
      } else if (spaceId === 'resources') {
        queryClient.prefetchQuery({
          queryKey: ['resource-folders', communityId],
          staleTime: 10 * 60 * 1000, // 10 minutes
        });
      }

      // Clean up timeout reference
      hoverTimeouts.current.delete(key);
    }, HOVER_INTENT_DELAY);

    hoverTimeouts.current.set(key, timeout);
  }, [queryClient]);

  // Handle space hover end
  const onSpaceHoverEnd = useCallback((communityId: string, spaceId: string) => {
    const key = `space:${communityId}:${spaceId}`;

    const timeout = hoverTimeouts.current.get(key);
    if (timeout) {
      clearTimeout(timeout);
      hoverTimeouts.current.delete(key);
    }
  }, []);

  // Clean up all timeouts
  const cleanup = useCallback(() => {
    hoverTimeouts.current.forEach(timeout => clearTimeout(timeout));
    hoverTimeouts.current.clear();
    hoverHistory.current.clear();
  }, []);

  return {
    onCommunityHover,
    onCommunityHoverEnd,
    onSpaceHover,
    onSpaceHoverEnd,
    cleanup,
  };
}