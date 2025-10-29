import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';
import { useDataManager } from '@/components/DataManagerProvider';
import { logger } from '@/lib/logger';

/**
 * RelayChangeHandler - Centralized relay change detection and cache invalidation
 * 
 * This component handles all side effects when the user switches relays:
 * 1. Clears React Query cache
 * 2. Clears message IndexedDB cache
 * 3. Clears communities IndexedDB cache
 * 
 * This ensures data is always fresh from the currently selected relay.
 */
export function RelayChangeHandler() {
  const { config } = useAppContext();
  const queryClient = useQueryClient();
  const dataManager = useDataManager();
  const prevRelayUrlRef = useRef<string | null>(null);
  
  // Keep stable refs to avoid effect running on every DataManagerProvider render
  const dataManagerRef = useRef(dataManager);
  dataManagerRef.current = dataManager;

  useEffect(() => {
    // Only trigger on actual relay changes (not initial mount)
    if (prevRelayUrlRef.current !== null && prevRelayUrlRef.current !== config.relayUrl) {
      logger.log(`RelayChangeHandler: Relay changed from ${prevRelayUrlRef.current} to ${config.relayUrl}`);
      
      // Clear all caches
      logger.log('RelayChangeHandler: Clearing React Query cache...');
      queryClient.resetQueries();
      
      logger.log('RelayChangeHandler: Clearing message and community caches...');
      Promise.all([
        dataManagerRef.current.messaging.resetMessageDataAndCache(),
        dataManagerRef.current.communities.resetCommunitiesDataAndCache(),
      ]).then(() => {
        logger.log('RelayChangeHandler: All caches cleared, data will reload from new relay');
      }).catch((error) => {
        logger.error('RelayChangeHandler: Error clearing caches:', error);
      });
    }
    
    prevRelayUrlRef.current = config.relayUrl;
  }, [config.relayUrl, queryClient]);

  // This component doesn't render anything
  return null;
}

