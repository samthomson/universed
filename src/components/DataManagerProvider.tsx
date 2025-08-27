import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useDirectMessages } from '@/hooks/useDirectMessages';
import { useNostr } from '@nostrify/react';
import { validateDMEvent } from '@/lib/dmUtils';
import { logger } from '@/lib/logger';
import type { NostrEvent } from '@/types/nostr';

interface DataManagerContextType {
  messages: Map<string, {
    messages: NostrEvent[];
    lastActivity: number;
    lastMessage: NostrEvent | null;
    hasNIP4: boolean;
    hasNIP17: boolean;
  }>;
  isLoading: boolean;
  lastSync: {
    nip4: number | null;
    nip17: number | null;
  };
  conversations: {
    id: string;
    pubkey: string;
    lastMessage: NostrEvent | null;
    lastActivity: number;
    hasNIP4Messages: boolean;
    hasNIP17Messages: boolean;
    recentMessages: NostrEvent[];
    isKnown: boolean;
    isRequest: boolean;
    lastMessageFromUser: boolean;
  }[];
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
  
  const [messages, _setMessages] = useState<Map<string, {
    messages: NostrEvent[];
    lastActivity: number;
    lastMessage: NostrEvent | null;
    hasNIP4: boolean;
    hasNIP17: boolean;
  }>>(new Map());
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
    return allNIP17Events;
  }, [user, nostr]);

  // Stage 1: Read all past messages from storage for a specific protocol
  const loadPastMessages = useCallback(async (protocol: 'nip4' | 'nip17') => {
    logger.log(`DataManager: Stage 1 - Loading past ${protocol} messages from storage`);
    
    try {
      if (protocol === 'nip4') {
        const messages = await loadPastNIP4Messages();
        logger.log(`DataManager: NIP-4 Stage 1 complete: ${messages?.length || 0} messages loaded`);
        
        // Store NIP-4 messages organized by participant
        if (messages && messages.length > 0) {
          // Build up new state
          const newState = new Map();
          
          // Process messages and decrypt them
          for (const message of messages) {
            const isFromUser = message.pubkey === user?.pubkey;
            const recipientPTag = message.tags?.find(([name]) => name === 'p')?.[1];
            const otherPubkey = isFromUser ? recipientPTag : message.pubkey;
            
            if (!otherPubkey || otherPubkey === user?.pubkey) continue;
            
            // Decrypt the NIP-4 message content
            let decryptedContent: string;
            try {
              if (user?.signer?.nip04) {
                decryptedContent = await user.signer.nip04.decrypt(otherPubkey, message.content);
              } else {
                logger.error(`DataManager: No NIP-04 decryption available for message ${message.id}`);
                decryptedContent = '[No decryption method available]';
                continue;
              }
            } catch (error) {
              logger.error(`DataManager: Failed to decrypt message ${message.id}:`, error);
              decryptedContent = '[Unable to decrypt message]';
              continue;
            }
            
            // Create decrypted message
            const decryptedMessage: NostrEvent = {
              ...message,
              content: decryptedContent,
            };
            
            // Add to new state or create new participant
            if (!newState.has(otherPubkey)) {
              newState.set(otherPubkey, {
                messages: [],
                lastActivity: 0,
                lastMessage: null,
                hasNIP4: false,
                hasNIP17: false,
              });
            }
            
            const participant = newState.get(otherPubkey)!;
            participant.messages.push(decryptedMessage);
            participant.hasNIP4 = true;
          }
          
          // Sort all participants' messages once after adding all messages
          newState.forEach(participant => {
            participant.messages.sort((a, b) => b.created_at - a.created_at); // Latest first
            if (participant.messages.length > 0) {
              participant.lastActivity = participant.messages[0].created_at; // First after sorting
              participant.lastMessage = participant.messages[0];
            }
          });
          
          // Update state with new data
          _setMessages(prev => {
            const finalMap = new Map(prev);
            newState.forEach((value, key) => finalMap.set(key, value));
            return finalMap;
          });
          
          logger.log(`DataManager: Stored ${messages.length} decrypted NIP-4 messages for ${newState.size} participants`);
        }
      } else if (protocol === 'nip17') {
        const messages = await loadPastNIP17Messages();
        logger.log(`DataManager: NIP-17 Stage 1 complete: ${messages?.length || 0} messages loaded`);
        
        // Store NIP-17 messages organized by participant
        if (messages && messages.length > 0) {
          // Build up new state
          const newState = new Map();
          
          // Process messages and decrypt them
          for (const giftWrap of messages) {
            if (!user?.signer?.nip44) {
              logger.error(`DataManager: No NIP-44 signer available for NIP-17 message ${giftWrap.id}`);
              continue;
            }

            try {
              // Step 1: Decrypt the Gift Wrap content
              const decryptedContent = await user.signer.nip44.decrypt(
                giftWrap.pubkey,
                giftWrap.content
              );
              
              // Step 2: Parse as JSON to get the Seal event
              let sealEvent: NostrEvent;
              try {
                sealEvent = JSON.parse(decryptedContent) as NostrEvent;
                if (sealEvent.kind !== 13) {
                  logger.error(`DataManager: Not a valid Seal (kind !== 13), got kind: ${sealEvent.kind}`);
                  continue;
                }
              } catch (error) {
                logger.error(`DataManager: Failed to parse seal JSON:`, error);
                continue;
              }
            
              // Step 3: Decrypt the Seal to get the actual message (Kind 14)
              const decryptedMessageContent = await user.signer.nip44.decrypt(
                sealEvent.pubkey,
                sealEvent.content
              );
              
              const messageEvent = JSON.parse(decryptedMessageContent) as NostrEvent;
              
              // Validate that we got a Private DM (Kind 14)
              if (messageEvent.kind !== 14) {
                logger.error(`DataManager: Not a valid Private DM (kind !== 14), got kind: ${messageEvent.kind}`);
                continue;
              }

              // Extract conversation partner
              let conversationPartner: string;
              if (sealEvent.pubkey === user.pubkey) {
                // This is a message we sent - get recipient from Private DM's p tag
                const recipientPTag = messageEvent.tags.find(([name]) => name === 'p')?.[1];
                if (!recipientPTag || recipientPTag === user.pubkey) {
                  logger.error(`DataManager: Invalid recipient in sent message - p tag: ${recipientPTag}`);
                  continue;
                }
                conversationPartner = recipientPTag;
              } else {
                // This is a message we received - sender is the seal author
                conversationPartner = sealEvent.pubkey;
              }
              
              // Add to new state or create new participant
              if (!newState.has(conversationPartner)) {
                newState.set(conversationPartner, {
                  messages: [],
                  lastActivity: 0,
                  lastMessage: null,
                  hasNIP4: false,
                  hasNIP17: false,
                });
              }
              
              const participant = newState.get(conversationPartner)!;
              participant.messages.push(messageEvent);
              participant.hasNIP17 = true;
              
            } catch (error) {
              logger.error(`DataManager: Failed to decrypt NIP-17 message ${giftWrap.id}:`, error);
              continue;
            }
          }
          
          // Sort all participants' messages once after adding all messages
          newState.forEach(participant => {
            participant.messages.sort((a, b) => b.created_at - a.created_at); // Latest first
            if (participant.messages.length > 0) {
              participant.lastActivity = participant.messages[0].created_at; // First after sorting
              participant.lastMessage = participant.messages[0];
            }
          });
          
          // Update state with new data
          _setMessages(prev => {
            const finalMap = new Map(prev);
            newState.forEach((value, key) => finalMap.set(key, value));
            return finalMap;
          });
          
          logger.log(`DataManager: Stored ${messages.length} decrypted NIP-17 messages for ${newState.size} participants`);
        }
      }
    } catch (error) {
      logger.error(`DataManager: Error in Stage 1 for ${protocol}:`, error);
    }
  }, [loadPastNIP4Messages, loadPastNIP17Messages, user]);

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
  }, [loadPastMessages, queryMissedMessages, startMessageSubscription, setLastSync]);

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
  }, [settings.enableNIP17, loadMessagesForProtocol, setIsLoading]);

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

  // Memoized conversation summary - now much simpler since messages are already organized by participant
  const conversations = useMemo(() => {
    const conversationsList: {
      id: string;
      pubkey: string;
      lastMessage: NostrEvent | null;
      lastActivity: number;
      hasNIP4Messages: boolean;
      hasNIP17Messages: boolean;
      recentMessages: NostrEvent[];
      isKnown: boolean;
      isRequest: boolean;
      lastMessageFromUser: boolean;
    }[] = [];
    
    messages.forEach((participant, participantPubkey) => {
      if (!participant.messages.length) return;
      
      // Get the most recent message to determine who sent it
      const lastMessage = participant.messages[participant.messages.length - 1]; // Last in chronological order
      const isFromUser = lastMessage.pubkey === user?.pubkey;
      
      conversationsList.push({
        id: participantPubkey,
        pubkey: participantPubkey,
        lastMessage: participant.lastMessage,
        lastActivity: participant.lastActivity,
        hasNIP4Messages: participant.hasNIP4,
        hasNIP17Messages: participant.hasNIP17,
        recentMessages: participant.messages.slice(-10), // Last 10 messages
        isKnown: true, // All messages in DataManager are "known"
        isRequest: false, // All messages in DataManager are "known"
        lastMessageFromUser: isFromUser,
      });
    });
    
    return conversationsList.sort((a, b) => b.lastActivity - a.lastActivity);
  }, [messages, user?.pubkey]);

  const getDebugInfo = () => {
    // Count total messages from all participants
    let totalMessageCount = 0;
    let nip4Count = 0;
    let nip17Count = 0;
    
    messages.forEach((participant) => {
      totalMessageCount += participant.messages.length;
      if (participant.hasNIP4) {
        const nip4Messages = participant.messages.filter((msg: NostrEvent) => msg.kind === 4);
        nip4Count += nip4Messages.length;
      }
      if (participant.hasNIP17) {
        const nip17Messages = participant.messages.filter((msg: NostrEvent) => msg.kind === 1059 || msg.kind === 14);
        nip17Count += nip17Messages.length;
      }
    });
    
    return {
      messageCount: totalMessageCount,
      nip4Count,
      nip17Count,
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
    conversations,
    getDebugInfo,
    isDebugging: true, // Hardcoded for now
  };

  return (
    <DataManagerContext.Provider value={contextValue}>
      {children}
    </DataManagerContext.Provider>
  );
}
