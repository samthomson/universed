import { useEffect, useRef } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserSettings } from '@/hooks/useUserSettings';
import { DataManager } from '@/lib/DataManager';
import { logger } from '@/lib/logger';

interface DataManagerProviderProps {
  children: React.ReactNode;
}

/**
 * DataManagerProvider - Initializes and manages the DataManager singleton lifecycle
 * 
 * This provider:
 * 1. Initializes the DataManager singleton when the app starts
 * 2. Connects it with React Query for cache management
 * 3. Starts initial data loads when user logs in
 * 4. Manages cleanup when the app unmounts
 */
export function DataManagerProvider({ children }: DataManagerProviderProps) {
  const { user } = useCurrentUser();
  const { settings } = useUserSettings();
  const initializationRef = useRef(false);

  // React to NIP17 setting changes using the reactive settings hook
  useEffect(() => {
    const dataManager = DataManager.getInstance();
    dataManager.onNIP17EnabledChanged(settings.enableNIP17);
  }, [settings.enableNIP17]);

  // Start loading app data when user logs in
  useEffect(() => {
    if (user && !initializationRef.current) {
      const dataManager = DataManager.getInstance();
      
      // Start loading app data
      dataManager.startLoadingApp().catch((error) => {
        logger.error('Failed to initialize DataManager:', error);
      });
      
      initializationRef.current = true;
    }
  }, [user]);

  // Cleanup when app unmounts (mainly for development/testing)
  useEffect(() => {
    return () => {
      // In production, we might want to keep subscriptions alive
      // But for development, clean up to prevent memory leaks
      if (process.env.NODE_ENV === 'development') {
        const dataManager = DataManager.getInstance();
        dataManager.cleanup();
      }
    };
  }, []);

  return <>{children}</>;
}
