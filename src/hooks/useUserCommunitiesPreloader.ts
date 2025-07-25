import { useEffect, useRef } from 'react';
import { useCurrentUser } from './useCurrentUser';
import { useUserCommunitiesCache } from './useUserCommunitiesCache';
import { useUserCommunities } from './useUserCommunities';

/**
 * Hook that immediately preloads user communities when the user logs in.
 * This ensures the communities list is available instantly on subsequent loads.
 */
export function useUserCommunitiesPreloader() {
  const { user } = useCurrentUser();
  const { prefetchUserCommunities, getCachedCommunitiesCount } = useUserCommunitiesCache();
  const { data: userCommunities } = useUserCommunities();

  const hasPreloadedRef = useRef<string | null>(null);
  const preloadTimeoutRef = useRef<NodeJS.Timeout>();

  // Preload communities immediately when user logs in
  useEffect(() => {
    if (!user?.pubkey) {
      hasPreloadedRef.current = null;
      return;
    }

    // Don't preload multiple times for the same user
    if (hasPreloadedRef.current === user.pubkey) {
      return;
    }

    // Clear any existing timeout
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }

    // Check if we already have cached data
    const cachedCount = getCachedCommunitiesCount();

    if (cachedCount > 0) {
      // We already have cached data, mark as preloaded
      hasPreloadedRef.current = user.pubkey;
      console.log(`User communities already cached: ${cachedCount} communities`);
      return;
    }

    // Start preloading immediately for new users
    console.log('Preloading user communities for:', user.pubkey);
    prefetchUserCommunities();

    // Also trigger the main query to ensure data is loaded
    // This will happen automatically due to the useUserCommunities hook above

    hasPreloadedRef.current = user.pubkey;

    // Cleanup timeout on unmount or dependency change
    return () => {
      const timeout = preloadTimeoutRef.current;
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [user?.pubkey, prefetchUserCommunities, getCachedCommunitiesCount]);

  // Log when communities are successfully loaded
  useEffect(() => {
    if (userCommunities && userCommunities.length > 0 && user?.pubkey) {
      console.log(`User communities loaded: ${userCommunities.length} communities for ${user.pubkey}`);
    }
  }, [userCommunities, user?.pubkey]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const timeout = preloadTimeoutRef.current;
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, []);

  return {
    isPreloaded: hasPreloadedRef.current === user?.pubkey,
    communitiesCount: userCommunities?.length || 0,
  };
}

/**
 * Lightweight hook that just enables user communities preloading without exposing controls.
 * Use this in components that should trigger preloading but don't need to control it.
 */
export function useEnableUserCommunitiesPreloader() {
  useUserCommunitiesPreloader();
}