import { useState, useEffect } from 'react';
import { DataManager, DataManagerState } from '@/lib/DataManager';

/**
 * Hook to access the DataManager singleton
 * 
 * This provides a React-friendly way to access the DataManager
 * from any component in the app.
 * 
 * @returns The DataManager singleton instance
 */
export function useDataManager(): DataManager {
  return DataManager.getInstance();
}

/**
 * Hook to get the full DataManager state
 * 
 * This hook provides reactive access to all DataManager state
 * including loading status, communities, messages, etc.
 */
export function useDataManagerState(): DataManagerState {
  const [state, setState] = useState(() => {
    const dataManager = DataManager.getInstance();
    return dataManager.getState();
  });

  useEffect(() => {
    const dataManager = DataManager.getInstance();
    
    // Subscribe to all state changes
    const unsubscribe = dataManager.subscribeToState((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, []);

  return state;
}

/**
 * Hook to get just the app loading state (convenience hook)
 * 
 * This hook provides reactive access to the DataManager's loading state
 * so components can show loading screens during initial app data loading.
 */
export function useAppLoading(): boolean {
  const state = useDataManagerState();
  return state.isLoadingApp;
}

/**
 * Hook to get communities data (convenience hook)
 * 
 * This hook provides reactive access to the communities data.
 */
export function useCommunities(): unknown[] {
  const state = useDataManagerState();
  return state.communities;
}
