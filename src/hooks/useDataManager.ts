import { useState, useEffect } from 'react';
import { DataManager } from '@/lib/DataManager';

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
 * Hook to get the app loading state from DataManager
 * 
 * This hook provides reactive access to the DataManager's loading state
 * so components can show loading screens during initial app data loading.
 */
export function useAppLoading() {
  const [isLoading, setIsLoading] = useState(() => {
    const dataManager = DataManager.getInstance();
    return dataManager.getIsLoadingApp();
  });

  useEffect(() => {
    const dataManager = DataManager.getInstance();
    
    // Subscribe to loading state changes
    const unsubscribe = dataManager.subscribeToLoadingState((newLoadingState) => {
      setIsLoading(newLoadingState);
    });

    return unsubscribe;
  }, []);

  return isLoading;
}
