import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useDirectMessages } from '@/hooks/useDirectMessages';
import { useNostr } from '@nostrify/react';
import { validateDMEvent } from '@/lib/dmUtils';
import { logger } from '@/lib/logger';
import type { NostrEvent } from '@/types/nostr';

interface DataManagerContextType {
  messages: Map<string, unknown[]>;
  isLoading: boolean;
  lastSync: {
    nip4: number | null;
    nip17: number | null;
  };
  getDebugInfo: () => { 
    messageCount: number; 
    nip4Count: number;
    nip17Count: number;
    nip4Sync: string; 
    nip17Sync: string;
    nip4Subscribed: boolean;
    nip17Subscribed: boolean;
    nip17Enabled: boolean;
  };
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
  const { nostr } = useNostr();
  
  // Use existing hook to kick off message loading
  const _directMessages = useDirectMessages();
  
  const [messages, _setMessages] = useState<Map<string, unknown[]>>(new Map());
  const [lastSync, setLastSync] = useState<{ nip4: number | null; nip17: number | null }>({
    nip4: null,
    nip17: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [subscriptions, _setSubscriptions] = useState<{ nip4: boolean; nip17: boolean }>({
    nip4: false,
    nip17: false
  });

  useEffect(() => {
    if (!user) return;
    
    // Start the 3-stage message loading process when user logs in
    startMessageLoading();
  }, [user]);

  // Load past NIP-4 messages from relays (following useNIP4DirectMessages pattern)
  const loadPastNIP4Messages = useCallback(async (sinceTimestamp?: number) => {
    logger.log(`DataManager: Loading past NIP-4 messages since ${sinceTimestamp ? new Date(sinceTimestamp * 1000).toISOString() : 'beginning'}`);
    
    if (!user?.signer?.nip04) {
      logger.error('DataManager: No NIP-04 signer available for user');
      return;
    }

    let allMessages: NostrEvent[] = [];
    let processedMessages = 0;
    let oldestTimestamp: number | undefined = sinceTimestamp;
    const SCAN_TOTAL_LIMIT = 20000;
    const SCAN_BATCH_SIZE = 1000;
    
    logger.log(`DataManager: Starting NIP-4 batch processing (limit: ${SCAN_TOTAL_LIMIT}, batch: ${SCAN_BATCH_SIZE})`);
    
    while (processedMessages < SCAN_TOTAL_LIMIT) {
      const batchLimit = Math.min(SCAN_BATCH_SIZE, SCAN_TOTAL_LIMIT - processedMessages);
      
      // Build filters for this batch - same as useNIP4DirectMessages
      const filters = [
        { 
          kinds: [4], 
          '#p': [user.pubkey], 
          limit: batchLimit,
          ...(oldestTimestamp && { until: oldestTimestamp })
        },
        { 
          kinds: [4], 
          authors: [user.pubkey], 
          limit: batchLimit,
          ...(oldestTimestamp && { until: oldestTimestamp })
        }
      ];
      
      logger.log(`DataManager: NIP-4 Batch ${Math.floor(processedMessages / SCAN_BATCH_SIZE) + 1}: requesting ${batchLimit} messages`);
      
      try {
        const batchDMs = await nostr.query(filters, { signal: AbortSignal.timeout(15000) });
        const validBatchDMs = batchDMs.filter(validateDMEvent);
        
        if (validBatchDMs.length === 0) {
          logger.log('DataManager: NIP-4 No more messages available, stopping scan');
          break;
        }
        
        allMessages = [...allMessages, ...validBatchDMs];
        processedMessages += validBatchDMs.length;
        
        // Update oldest timestamp for next batch
        const batchOldest = validBatchDMs.reduce((oldest, dm) => 
          dm.created_at < oldest ? dm.created_at : oldest, 
          validBatchDMs[0]?.created_at || 0
        );
        oldestTimestamp = batchOldest - 1; // Subtract 1 to avoid overlap
        
        logger.log(`DataManager: NIP-4 Batch complete: ${validBatchDMs.length} messages, total: ${allMessages.length}`);
        
        // Stop if we got fewer messages than requested (end of data)
        if (validBatchDMs.length < batchLimit) {
          logger.log('DataManager: NIP-4 Reached end of available messages');
          break;
        }
      } catch (error) {
        logger.error('DataManager: NIP-4 Error in batch query:', error);
        break;
      }
    }
    
    logger.log(`DataManager: NIP-4 Scan complete: ${allMessages.length} total messages processed`);
    
    // TODO: Decrypt messages and store in local state/IndexedDB
    // For now, just log the count
    return allMessages;
  }, [user, nostr]);

  // Load past NIP-17 messages from relays (following useNIP17DirectMessages pattern)
  const loadPastNIP17Messages = useCallback(async (sinceTimestamp?: number) => {
    logger.log(`DataManager: Loading past NIP-17 messages since ${sinceTimestamp ? new Date(sinceTimestamp * 1000).toISOString() : 'beginning'}`);
    
    if (!user?.signer?.nip44) {
      logger.error('DataManager: No NIP-44 signer available for user');
      return;
    }

    let allNIP17Events: NostrEvent[] = [];
    let processedMessages = 0;
    let oldestTimestamp: number | undefined = sinceTimestamp;
    const SCAN_TOTAL_LIMIT = 20000;
    const SCAN_BATCH_SIZE = 1000;
    
    logger.log(`DataManager: Starting NIP-17 batch processing (limit: ${SCAN_TOTAL_LIMIT}, batch: ${SCAN_BATCH_SIZE})`);
    
    while (processedMessages < SCAN_TOTAL_LIMIT) {
      const batchLimit = Math.min(SCAN_BATCH_SIZE, SCAN_TOTAL_LIMIT - processedMessages);
      
      // NIP-17: Query Kind 1059 (Gift Wrap) messages where we're the recipient
      const filters = [
        { 
          kinds: [1059], 
          '#p': [user.pubkey], // We are the recipient
          limit: batchLimit,
          ...(oldestTimestamp && { until: oldestTimestamp })
        }
      ];
      
      logger.log(`DataManager: NIP-17 Batch ${Math.floor(processedMessages / SCAN_BATCH_SIZE) + 1}: requesting ${batchLimit} Gift Wrap messages`);
      
      try {
        const batchEvents = await nostr.query(filters, { signal: AbortSignal.timeout(30000) });
        
        if (batchEvents.length === 0) {
          logger.log('DataManager: NIP-17 No more Gift Wrap messages available, stopping scan');
          break;
        }
        
        allNIP17Events = [...allNIP17Events, ...batchEvents];
        processedMessages += batchEvents.length;
        
        // Update oldest timestamp for next batch
        const batchOldest = batchEvents.reduce((oldest, event) => 
          event.created_at < oldest ? event.created_at : oldest, 
          batchEvents[0]?.created_at || 0
        );
        oldestTimestamp = batchOldest - 1; // Subtract 1 to avoid overlap
        
        logger.log(`DataManager: NIP-17 Batch complete: ${batchEvents.length} Gift Wrap messages, total: ${allNIP17Events.length}`);
        
        // Stop if we got fewer messages than requested (end of data)
        if (batchEvents.length < batchLimit) {
          logger.log('DataManager: NIP-17 Reached end of available Gift Wrap messages');
          break;
        }
      } catch (error) {
        logger.error('DataManager: NIP-17 Error in batch query:', error);
        break;
      }
    }
    
    logger.log(`DataManager: NIP-17 Scan complete: ${allNIP17Events.length} total Gift Wrap messages processed`);
    
    // TODO: Decrypt Gift Wrap messages and store in local state/IndexedDB
    // For now, just log the count
    return allNIP17Events;
  }, [user, nostr]);

  // Stage 1: Read all past messages from storage for a specific protocol
  const loadPastMessages = useCallback(async (protocol: 'nip4' | 'nip17') => {
    logger.log(`DataManager: Stage 1 - Loading past ${protocol} messages from storage`);
    
    try {
      if (protocol === 'nip4') {
        const messages = await loadPastNIP4Messages();
        logger.log(`DataManager: NIP-4 Stage 1 complete: ${messages?.length || 0} messages loaded`);
        
        // Store NIP-4 messages in the DataManager state
        if (messages && messages.length > 0) {
          _setMessages(prev => {
            const newMap = new Map(prev);
            // For now, store all NIP-4 messages under a single key
            // Later we can organize by conversation
            newMap.set('nip4', messages);
            logger.log(`DataManager: Stored ${messages.length} NIP-4 messages in state`);
            return newMap;
          });
        }
      } else if (protocol === 'nip17') {
        const messages = await loadPastNIP17Messages();
        logger.log(`DataManager: NIP-17 Stage 1 complete: ${messages?.length || 0} messages loaded`);
        
        // Store NIP-17 messages in the DataManager state
        if (messages && messages.length > 0) {
          _setMessages(prev => {
            const newMap = new Map(prev);
            // For now, store all NIP-17 messages under a single key
            // Later we can organize by conversation
            newMap.set('nip17', messages);
            logger.log(`DataManager: Stored ${messages.length} NIP-17 messages in state`);
            return newMap;
          });
        }
      }
    } catch (error) {
      logger.error(`DataManager: Error in Stage 1 for ${protocol}:`, error);
    }
  }, [loadPastNIP4Messages, loadPastNIP17Messages]);

  // Stage 2: Query for messages between last sync and now for a specific protocol
  const queryMissedMessages = useCallback(async (protocol: 'nip4' | 'nip17') => {
    const lastSyncTime = lastSync[protocol];
    logger.log(`DataManager: Stage 2 - Querying for missed ${protocol} messages since ${lastSyncTime || 'never'}`);
    // TODO: Implement querying for messages since last sync
  }, [lastSync]);

  // Stage 3: Create subscription for new messages going forward for a specific protocol
  const startMessageSubscription = useCallback(async (protocol: 'nip4' | 'nip17') => {
    logger.log(`DataManager: Stage 3 - Starting ${protocol} message subscription`);
    // TODO: Implement real-time subscription
  }, []);

  // Load messages for a specific protocol using the 3-stage process
  const loadMessagesForProtocol = useCallback(async (protocol: 'nip4' | 'nip17') => {
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
  }, [loadPastMessages, queryMissedMessages, startMessageSubscription]);

  // Main method to start message loading for all enabled protocols
  const startMessageLoading = useCallback(async () => {
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
  }, [settings.enableNIP17, loadMessagesForProtocol]);

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
  }, [settings.enableNIP17, user, lastSync.nip17, loadMessagesForProtocol]);

  const getDebugInfo = () => {
    // Count total messages from both protocols
    const nip4Messages = messages.get('nip4') || [];
    const nip17Messages = messages.get('nip17') || [];
    const totalMessageCount = nip4Messages.length + nip17Messages.length;
    
    return {
      messageCount: totalMessageCount,
      nip4Count: nip4Messages.length,
      nip17Count: nip17Messages.length,
      nip4Sync: lastSync.nip4 ? new Date(lastSync.nip4).toLocaleTimeString() : 'Never',
      nip17Sync: lastSync.nip17 ? new Date(lastSync.nip17).toLocaleTimeString() : 'Never',
      nip4Subscribed: subscriptions.nip4,
      nip17Subscribed: subscriptions.nip17,
      nip17Enabled: settings.enableNIP17,
    };
  };

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
