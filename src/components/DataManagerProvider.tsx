import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserSettings } from '@/hooks/useUserSettings';
import { DataManager } from '@/lib/DataManager';

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
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { settings } = useUserSettings();
  const initializationRef = useRef(false);

  // Initialize DataManager once when the provider mounts
  useEffect(() => {
    if (!initializationRef.current) {
      const dataManager = DataManager.getInstance();
      
      // TODO: Initialize DataManager with dependencies
      // dataManager.initialize(queryClient, nostr);
      
      initializationRef.current = true;
    }
  }, [queryClient]);

  // React to NIP17 setting changes using the reactive settings hook
  useEffect(() => {
    if (initializationRef.current) {
      const dataManager = DataManager.getInstance();
      dataManager.onNIP17EnabledChanged(settings.enableNIP17);
    }
  }, [settings.enableNIP17]);

  // Start initial data loads when user logs in
  useEffect(() => {
    if (user && initializationRef.current) {
      const dataManager = DataManager.getInstance();
      
      // TODO: Start initial data loads for the logged-in user
      // dataManager.startInitialLoads(user);
    }
  }, [user]);

  // Cleanup when app unmounts (mainly for development/testing)
  useEffect(() => {
    return () => {
      // In production, we might want to keep subscriptions alive
      // But for development, clean up to prevent memory leaks
      if (process.env.NODE_ENV === 'development') {
        const dataManager = DataManager.getInstance();
        // TODO: Add cleanup method
        // dataManager.cleanup();
      }
    };
  }, []);

  return <>{children}</>;
}
