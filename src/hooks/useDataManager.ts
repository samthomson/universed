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
