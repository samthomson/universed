import { useEffect, useRef } from 'react';
import { useUserCommunities } from './useUserCommunities';
import { useChannelPreloader } from './useChannelPreloader';
import { useCurrentUser } from './useCurrentUser';

const INITIAL_PRELOAD_DELAY = 3000; // Wait 3 seconds after app loads
const BATCH_DELAY = 1000; // 1 second between batches
const COMMUNITIES_PER_BATCH = 3; // Preload 3 communities at a time

/**
 * Hook that automatically preloads channels for all user communities in the background.
 * This ensures that when users navigate to their communities, channels load instantly.
 */
export function useUserCommunitiesChannelPreloader() {
  const { data: userCommunities } = useUserCommunities();
  const { user } = useCurrentUser();
  const { preloadMultiple, getPreloadStats } = useChannelPreloader();
  
  const hasPreloadedRef = useRef(false);
  const preloadTimeoutRef = useRef<NodeJS.Timeout>();

  // Preload channels for user communities in batches
  useEffect(() => {
    // Only run if user is logged in and has communities
    if (!user?.pubkey || !userCommunities || userCommunities.length === 0) {
      return;
    }

    // Don't preload multiple times for the same set of communities
    if (hasPreloadedRef.current) {
      return;
    }

    // Clear any existing timeout
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }

    // Start preloading after initial delay
    preloadTimeoutRef.current = setTimeout(() => {
      const communityIds = userCommunities.map(community => community.id);
      
      // Prioritize communities by membership status
      const prioritizedIds = communityIds.sort((a, b) => {
        const communityA = userCommunities.find(c => c.id === a);
        const communityB = userCommunities.find(c => c.id === b);
        
        if (!communityA || !communityB) return 0;
        
        const statusOrder = { owner: 0, moderator: 1, approved: 2 };
        return statusOrder[communityA.membershipStatus] - statusOrder[communityB.membershipStatus];
      });

      // Preload in batches to avoid overwhelming the relay
      const preloadBatch = async (startIndex: number) => {
        const batch = prioritizedIds.slice(startIndex, startIndex + COMMUNITIES_PER_BATCH);
        
        if (batch.length > 0) {
          console.log(`Preloading channels for communities batch ${Math.floor(startIndex / COMMUNITIES_PER_BATCH) + 1}:`, batch);
          preloadMultiple(batch);
          
          // Schedule next batch
          const nextIndex = startIndex + COMMUNITIES_PER_BATCH;
          if (nextIndex < prioritizedIds.length) {
            setTimeout(() => preloadBatch(nextIndex), BATCH_DELAY);
          } else {
            // All batches completed
            hasPreloadedRef.current = true;
            console.log('Completed preloading channels for all user communities');
            
            // Log stats
            const stats = getPreloadStats();
            console.log('Channel preload stats:', stats);
          }
        }
      };

      // Start with first batch
      preloadBatch(0);
    }, INITIAL_PRELOAD_DELAY);

    // Cleanup timeout on unmount or dependency change
    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, [user?.pubkey, userCommunities, preloadMultiple, getPreloadStats]);

  // Reset preload flag when user changes or communities change significantly
  useEffect(() => {
    hasPreloadedRef.current = false;
  }, [user?.pubkey]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, []);
}