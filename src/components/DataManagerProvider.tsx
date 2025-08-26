import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useDirectMessages } from '@/hooks/useDirectMessages';
import { logger } from '@/lib/logger';

interface DataManagerContextType {
  messages: Map<string, unknown[]>;
  isLoading: boolean;
  lastSync: {
    nip4: number | null;
    nip17: number | null;
  };
  getDebugInfo: () => { messageCount: number; nip4Sync: string; nip17Sync: string };
  isDebugging: boolean;
}

const DataManagerContext = createContext<DataManagerContextType | null>(null);

export function useDataManager(): DataManagerContextType {
  const context = useContext(DataManagerContext);
  if (!context) {
    throw new Error('useDataManager must be used within DataManagerProvider');
  }
  return context;
}

interface DataManagerProviderProps {
  children: ReactNode;
}

export function DataManagerProvider({ children }: DataManagerProviderProps) {
  const { user } = useCurrentUser();
  const { settings } = useUserSettings();
  
  // Use existing hook to kick off message loading
  const _directMessages = useDirectMessages();
  
  const [messages, _setMessages] = useState<Map<string, unknown[]>>(new Map());
  const [lastSync, setLastSync] = useState<{ nip4: number | null; nip17: number | null }>({
    nip4: null,
    nip17: null
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    // Start the 3-stage message loading process when user logs in
    startMessageLoading();
  }, [user]);

  // Stage 1: Read all past messages from storage for a specific protocol
  const loadPastMessages = async (protocol: 'nip4' | 'nip17') => {
    logger.log(`DataManager: Stage 1 - Loading past ${protocol} messages from storage`);
    // TODO: Implement loading from IndexedDB/localStorage
  };

  // Stage 2: Query for messages between last sync and now for a specific protocol
  const queryMissedMessages = async (protocol: 'nip4' | 'nip17') => {
    const lastSyncTime = lastSync[protocol];
    logger.log(`DataManager: Stage 2 - Querying for missed ${protocol} messages since ${lastSyncTime || 'never'}`);
    // TODO: Implement querying for messages since last sync
  };

  // Stage 3: Create subscription for new messages going forward for a specific protocol
  const startMessageSubscription = async (protocol: 'nip4' | 'nip17') => {
    logger.log(`DataManager: Stage 3 - Starting ${protocol} message subscription`);
    // TODO: Implement real-time subscription
  };

  // Load messages for a specific protocol using the 3-stage process
  const loadMessagesForProtocol = async (protocol: 'nip4' | 'nip17') => {
    logger.log(`DataManager: Starting 3-stage process for ${protocol}`);
    
    try {
      await loadPastMessages(protocol);
      await queryMissedMessages(protocol);
      await startMessageSubscription(protocol);
      
      // Update last sync time for this protocol
      setLastSync(prev => ({ ...prev, [protocol]: Date.now() }));
      
      logger.log(`DataManager: ${protocol} 3-stage process complete`);
    } catch (error) {
      logger.error(`DataManager: Error in ${protocol} 3-stage process:`, error);
    }
  };

  // Main method to start message loading for all enabled protocols
  const startMessageLoading = async () => {
    logger.log('DataManager: Starting message loading for all enabled protocols');
    setIsLoading(true);
    
    try {
      // Always load NIP-4 messages
      await loadMessagesForProtocol('nip4');
      
      // Load NIP-17 messages if enabled
      if (settings.enableNIP17) {
        await loadMessagesForProtocol('nip17');
      }
      
      logger.log('DataManager: All protocol loading complete');
    } catch (error) {
      logger.error('DataManager: Error in message loading:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    logger.log(`DataManager: NIP-17 ${settings.enableNIP17 ? 'enabled' : 'disabled'}`);
    
    // If NIP-17 was enabled, start loading NIP-17 messages
    if (settings.enableNIP17 && lastSync.nip17 === null) {
      logger.log('DataManager: NIP-17 enabled, starting NIP-17 message loading');
      loadMessagesForProtocol('nip17');
    } else {
      // todo: drop all nip 17 messages and the subscription
    }
  }, [settings.enableNIP17, user, lastSync.nip17]);

  const getDebugInfo = () => ({
    messageCount: messages.size,
    nip4Sync: lastSync.nip4 ? new Date(lastSync.nip4).toLocaleTimeString() : 'Never',
    nip17Sync: lastSync.nip17 ? new Date(lastSync.nip17).toLocaleTimeString() : 'Never',
  });

  const contextValue: DataManagerContextType = {
    messages,
    isLoading,
    lastSync,
    getDebugInfo,
    isDebugging: true, // Hardcoded for now
  };

  return (
    <DataManagerContext.Provider value={contextValue}>
      {children}
    </DataManagerContext.Provider>
  );
}
