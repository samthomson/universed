import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo, useRef } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserSettings } from '@/hooks/useUserSettings';
// import { useDirectMessages } from '@/hooks/useDirectMessages';
import { useNostr } from '@nostrify/react';
import { validateDMEvent } from '@/lib/dmUtils';
import { logger } from '@/lib/logger';
import type { NostrEvent } from '@/types/nostr';

// Simple utility for debounced error logging
const createErrorLogger = (name: string) => {
  let count = 0;
  let timeout: NodeJS.Timeout | null = null;
  
  return (_error: Error) => {
    count++;
    
    if (timeout) clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      if (count > 0) {
        logger.error(`DMS: DataManager: ${name} processing complete with ${count} errors`);
        count = 0;
      }
    }, 2000);
  };
};

// Create error loggers outside component to prevent recreation
const nip17ErrorLogger = createErrorLogger('NIP-17');

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
  writeAllMessagesToStore: () => Promise<void>;
  clearIndexedDB: () => Promise<void>;
  handleNIP17SettingChange: (enabled: boolean) => Promise<void>;
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

// Hook for conversation-specific message subscriptions to avoid unnecessary re-renders
export function useConversationMessages(conversationId: string) {
  const { messages: allMessages } = useDataManager();
  
  return useMemo(() => {
    const conversationData = allMessages.get(conversationId);
    
    if (!conversationData) {
      return {
        messages: [],
        hasMoreMessages: false,
        totalCount: 0,
        lastMessage: null,
        lastActivity: 0,
      };
    }
    
    return {
      messages: conversationData.messages,
      hasMoreMessages: false, // This will be handled by pagination logic
      totalCount: conversationData.messages.length,
      lastMessage: conversationData.lastMessage,
      lastActivity: conversationData.lastActivity,
    };
  }, [allMessages, conversationId]);
}

interface DataManagerProviderProps {
  children: ReactNode;
}

export function DataManagerProvider({ children }: DataManagerProviderProps) {
  const { user } = useCurrentUser();
  const { settings } = useUserSettings();
  const { nostr } = useNostr();
  
  // Use existing hook to kick off message loading
  // const _directMessages = useDirectMessages();
  
  // Memoize the user pubkey to prevent unnecessary re-renders
  const userPubkey = useMemo(() => user?.pubkey, [user?.pubkey]);
  
  const [messages, setMessages] = useState<Map<string, {
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
  const [protocolLoading, setProtocolLoading] = useState<{ nip4: boolean; nip17: boolean }>({
    nip4: false,
    nip17: false
  });
  const [subscriptions, _setSubscriptions] = useState<{ nip4: boolean; nip17: boolean }>({
    nip4: false,
    nip17: false
  });
  
  // Track whether initial load has already completed
  const [hasInitialLoadCompleted, setHasInitialLoadCompleted] = useState(false);

  // Single, deterministic message loading - happens exactly once when provider initializes
  useEffect(() => {
    logger.log('DMS: DataManager: Main effect triggered with:', { userPubkey, hasInitialLoadCompleted, isLoading });
    
    if (!userPubkey) {
      logger.log('DMS: DataManager: No user pubkey available, skipping message loading');
      return;
    }
    
    if (hasInitialLoadCompleted) {
      logger.log('DMS: DataManager: Initial load already completed, skipping duplicate request');
      return;
    }
    
    if (isLoading) {
      logger.log('DMS: DataManager: Message loading already in progress, skipping duplicate request');
      return;
    }
    
    logger.log('DMS: DataManager: Starting initial message loading process');
    startMessageLoading();
  }, [userPubkey, hasInitialLoadCompleted, isLoading]); // Only depend on user pubkey - settings are handled separately

  // Load past NIP-4 messages from relays (following useNIP4DirectMessages pattern)
  const loadPastNIP4Messages = useCallback(async (sinceTimestamp?: number) => {
    logger.log(`DMS: DataManager: Loading past NIP-4 messages since ${sinceTimestamp ? new Date(sinceTimestamp * 1000).toISOString() : 'beginning'}`);
    
    if (!user?.signer?.nip04) {
      logger.error('DMS: DataManager: No NIP-04 signer available for user');
      return;
    }

    let allMessages: NostrEvent[] = [];
    let processedMessages = 0;
    let oldestTimestamp: number | undefined = sinceTimestamp;
    const SCAN_TOTAL_LIMIT = 20000;
    const SCAN_BATCH_SIZE = 1000;
    
    logger.log(`DMS: DataManager: Starting NIP-4 batch processing (limit: ${SCAN_TOTAL_LIMIT}, batch: ${SCAN_BATCH_SIZE})`);
    
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
      
      logger.log(`DMS: DataManager: NIP-4 Batch ${Math.floor(processedMessages / SCAN_BATCH_SIZE) + 1}: requesting ${batchLimit} messages`);
      
      try {
        const batchDMs = await nostr.query(filters, { signal: AbortSignal.timeout(15000) });
        const validBatchDMs = batchDMs.filter(validateDMEvent);
        
        if (validBatchDMs.length === 0) {
          logger.log('DMS: DataManager: NIP-4 No more messages available, stopping scan');
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
        
        logger.log(`DMS: DataManager: NIP-4 Batch complete: ${validBatchDMs.length} messages, total: ${allMessages.length}`);
        
        // Stop if we got fewer messages than requested (end of data)
        if (validBatchDMs.length < batchLimit) {
          logger.log('DMS: DataManager: NIP-4 Reached end of available messages');
          break;
        }
      } catch (error) {
        logger.error('DMS: DataManager: NIP-4 Error in batch query:', error);
        break;
      }
    }
    
    logger.log(`DMS: DataManager: NIP-4 Scan complete: ${allMessages.length} total messages processed`);
    return allMessages;
  }, [user, nostr]);

  // Load past NIP-17 messages from relays (following useNIP17DirectMessages pattern)
  const loadPastNIP17Messages = useCallback(async (sinceTimestamp?: number) => {
    logger.log(`DMS: DataManager: Loading past NIP-17 messages since ${sinceTimestamp ? new Date(sinceTimestamp * 1000).toISOString() : 'beginning'}`);
    
    if (!user?.signer?.nip44) {
      logger.error('DMS: DataManager: No NIP-44 signer available for user');
      return;
    }

    let allNIP17Events: NostrEvent[] = [];
    let processedMessages = 0;
    let oldestTimestamp: number | undefined = sinceTimestamp;
    const SCAN_TOTAL_LIMIT = 20000;
    const SCAN_BATCH_SIZE = 1000;
    
    logger.log(`DMS: DataManager: Starting NIP-17 batch processing (limit: ${SCAN_TOTAL_LIMIT}, batch: ${SCAN_BATCH_SIZE})`);
    
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
      
                logger.log(`DMS: DataManager: NIP-17 Batch ${Math.floor(processedMessages / SCAN_BATCH_SIZE) + 1}: requesting ${batchLimit} Gift Wrap messages`);
      
      try {
        const batchEvents = await nostr.query(filters, { signal: AbortSignal.timeout(30000) });
        
        if (batchEvents.length === 0) {
          logger.log('DMS: DataManager: NIP-17 No more Gift Wrap messages available, stopping scan');
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
        
                  logger.log(`DMS: DataManager: NIP-17 Batch complete: ${batchEvents.length} Gift Wrap messages, total: ${allNIP17Events.length}`);
        
        // Stop if we got fewer messages than requested (end of data)
        if (batchEvents.length < batchLimit) {
          logger.log('DMS: DataManager: NIP-17 Reached end of available Gift Wrap messages');
          break;
        }
      } catch (error) {
                  logger.error('DMS: DataManager: NIP-17 Error in batch query:', error);
        break;
      }
    }
    
          logger.log(`DMS: DataManager: NIP-17 Scan complete: ${allNIP17Events.length} total Gift Wrap messages processed`);
    return allNIP17Events;
  }, [user, nostr]);

  // Stage 1: Read all past messages from storage for a specific protocol
  const loadPastMessages = useCallback(async (protocol: 'nip4' | 'nip17') => {
    const startTime = Date.now();
    logger.log(`DMS: DataManager: [${protocol.toUpperCase()}] Stage 1 - Loading past messages from storage`);
    
    // Skip NIP-17 if it's disabled
    if (protocol === 'nip17' && !settings.enableNIP17) {
              logger.log('DMS: DataManager: NIP-17 disabled, skipping message loading');
      return;
    }
    
    // Ensure we have a user pubkey
    if (!userPubkey) {
      logger.log('DMS: DataManager: No user pubkey available, skipping message loading');
      return;
    }
    
    try {
      // First, read any cached messages from IndexedDB to get the newest timestamp
      let sinceTimestamp: number | undefined;
      let dbReadTime: number;
      try {
        const dbStartTime = Date.now();
        const { readMessagesFromDB } = await import('@/lib/messageStore');
        const cachedStore = await readMessagesFromDB(userPubkey);
        dbReadTime = Date.now() - dbStartTime;
        
        if (cachedStore && Object.keys(cachedStore.participants).length > 0) {
          logger.log(`DMS: DataManager: ✅ Found cached store with ${Object.keys(cachedStore.participants).length} participants (${dbReadTime}ms)`);
          
          // Filter participants based on NIP-17 setting
          const filteredParticipants = settings.enableNIP17 
            ? cachedStore.participants 
            : Object.fromEntries(
                Object.entries(cachedStore.participants).filter(([_, participant]) => 
                  !participant.hasNIP17
                )
              );
          
          // Find the newest message timestamp across filtered participants
          let newestTimestamp = 0;
          let totalMessages = 0;
          let filteredOutCount = 0;
          
          Object.values(filteredParticipants).forEach(participant => {
            totalMessages += participant.messages.length;
            if (participant.messages.length > 0) {
              const participantNewest = Math.max(...participant.messages.map(m => m.created_at));
              if (participantNewest > newestTimestamp) {
                newestTimestamp = participantNewest;
              }
            }
          });
          
          filteredOutCount = Object.keys(cachedStore.participants).length - Object.keys(filteredParticipants).length;
          
          sinceTimestamp = newestTimestamp;
          logger.log(`DMS: DataManager: Found ${totalMessages} cached messages (${filteredOutCount} NIP-17 participants filtered out), newest timestamp: ${new Date(newestTimestamp * 1000).toISOString()}`);
          
          // Load filtered cached messages into state
          const newState = new Map();
          Object.entries(filteredParticipants).forEach(([participantPubkey, participant]) => {
            // Messages are already in NostrEvent format, just use them directly
            newState.set(participantPubkey, {
              messages: participant.messages,
              lastActivity: participant.lastActivity,
              lastMessage: participant.messages.length > 0 ? participant.messages[0] : null, // First after sorting
              hasNIP4: participant.hasNIP4,
              hasNIP17: participant.hasNIP17,
            });
          });
          
          // Update state with cached messages
          setMessages(newState);
          logger.log(`DMS: DataManager: ✅ Loaded ${totalMessages} cached messages for ${newState.size} participants into state`);
        } else {
          logger.log(`DMS: DataManager: No cached messages found in IndexedDB (${dbReadTime}ms)`);
        }
      } catch (error) {
        logger.error('DMS: DataManager: Error reading from IndexedDB:', error);
      }
      
      if (protocol === 'nip4') {
        const relayStartTime = Date.now();
        const messages = await loadPastNIP4Messages(sinceTimestamp);
        const relayTime = Date.now() - relayStartTime;
        logger.log(`DMS: DataManager: NIP-4 Stage 1 complete: ${messages?.length || 0} messages loaded from relays (${relayTime}ms)`);
        
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
                logger.error(`DMS: DataManager: No NIP-04 decryption available for message ${message.id}`);
                decryptedContent = '[No decryption method available]';
              }
            } catch (error) {
              logger.error(`DMS: DataManager: Failed to decrypt message ${message.id}:`, error);
              decryptedContent = '[Unable to decrypt message]';
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
          setMessages(prev => {
            const finalMap = new Map(prev);
            newState.forEach((value, key) => finalMap.set(key, value));
            return finalMap;
          });
          
          logger.log(`DMS: DataManager: Stored ${messages.length} decrypted NIP-4 messages for ${newState.size} participants`);
        }
      } else if (protocol === 'nip17') {
        const relayStartTime = Date.now();
        const messages = await loadPastNIP17Messages(sinceTimestamp);
        const relayTime = Date.now() - relayStartTime;
        logger.log(`DMS: DataManager: NIP-17 Stage 1 complete: ${messages?.length || 0} messages loaded from relays (${relayTime}ms)`);
        
        // Store NIP-17 messages organized by participant
        if (messages && messages.length > 0) {
          // Build up new state
          const newState = new Map();
          
          // Process messages and decrypt them
          for (const giftWrap of messages) {
            let processedMessage: NostrEvent;
            let conversationPartner: string;
            
            // Try to decrypt and process the message
            if (!user?.signer?.nip44) {
              // No decryption available - store with error placeholder
              conversationPartner = giftWrap.pubkey;
              processedMessage = {
                ...giftWrap,
                content: '[No NIP-44 decryption available]',
              };
            } else {
              try {
                // Decrypt Gift Wrap → Seal → Private DM
                const sealContent = await user.signer.nip44.decrypt(giftWrap.pubkey, giftWrap.content);
                const sealEvent = JSON.parse(sealContent) as NostrEvent;
                
                if (sealEvent.kind !== 13) {
                  // Invalid Seal format - store with error placeholder
                  conversationPartner = giftWrap.pubkey;
                  processedMessage = {
                    ...giftWrap,
                    content: `[Invalid Seal format - expected kind 13, got ${sealEvent.kind}]`,
                  };
                } else {
                  const messageContent = await user.signer.nip44.decrypt(sealEvent.pubkey, sealEvent.content);
                  const messageEvent = JSON.parse(messageContent) as NostrEvent;
                  
                  if (messageEvent.kind !== 14) {
                    // Invalid message format - store with error placeholder
                    conversationPartner = giftWrap.pubkey;
                    processedMessage = {
                      ...giftWrap,
                      content: `[Invalid message format - expected kind 14, got ${messageEvent.kind}]`,
                    };
                  } else {
                    // Determine conversation partner
                    if (sealEvent.pubkey === user.pubkey) {
                      const recipient = messageEvent.tags.find(([name]) => name === 'p')?.[1];
                      if (!recipient || recipient === user.pubkey) {
                        // Invalid recipient - store with error placeholder
                        conversationPartner = giftWrap.pubkey;
                        processedMessage = {
                          ...giftWrap,
                          content: '[Invalid recipient - malformed p tag]',
                        };
                      } else {
                        conversationPartner = recipient;
                        processedMessage = messageEvent;
                      }
                    } else {
                      conversationPartner = sealEvent.pubkey;
                      processedMessage = messageEvent;
                    }
                  }
                }
              } catch (error) {
                // Decryption/parsing failed - store with error placeholder
                nip17ErrorLogger(error);
                conversationPartner = giftWrap.pubkey;
                processedMessage = {
                  ...giftWrap,
                  content: '[Failed to decrypt or parse NIP-17 message]',
                };
              }
            }
            
            // Add message to state
            if (!newState.has(conversationPartner)) {
              newState.set(conversationPartner, {
                messages: [],
                lastActivity: 0,
                lastMessage: null,
                hasNIP4: false,
                hasNIP17: false,
              });
            }
            
            newState.get(conversationPartner)!.messages.push(processedMessage);
            newState.get(conversationPartner)!.hasNIP17 = true;
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
          setMessages(prev => {
            const finalMap = new Map(prev);
            newState.forEach((value, key) => finalMap.set(key, value));
            return finalMap;
          });
          
          logger.log(`DMS: DataManager: Stored ${messages.length} decrypted NIP-17 messages for ${newState.size} participants`);
        }
      }
      
      // Log total time for Stage 1
      const totalTime = Date.now() - startTime;
      logger.log(`DMS: DataManager: [${protocol.toUpperCase()}] Stage 1 complete in ${totalTime}ms`);
    } catch (error) {
              logger.error(`DMS: DataManager: Error in Stage 1 for ${protocol}:`, error);
    }
  }, [loadPastNIP4Messages, loadPastNIP17Messages, user, settings.enableNIP17, userPubkey]);

  // Stage 2: Query for messages between last sync and now for a specific protocol
  const queryMissedMessages = useCallback(async (protocol: 'nip4' | 'nip17') => {
    const lastSyncTime = lastSync[protocol];
          logger.log(`DMS: DataManager: [${protocol.toUpperCase()}] Stage 2 - Querying for missed messages since ${lastSyncTime || 'never'}`);
    // TODO: Implement querying for messages since last sync
  }, [lastSync]);

  // Stage 3: Create subscription for new messages going forward for a specific protocol
  const startMessageSubscription = useCallback(async (protocol: 'nip4' | 'nip17') => {
          logger.log(`DMS: DataManager: [${protocol.toUpperCase()}] Stage 3 - Starting message subscription`);
    // TODO: Implement real-time subscription
  }, []);

  // Load messages for a specific protocol using the 3-stage process
  const loadMessagesForProtocol = useCallback(async (protocol: 'nip4' | 'nip17') => {
    // Check if we're already loading this protocol
    if (protocolLoading[protocol]) {
      logger.log(`DMS: DataManager: Already loading ${protocol} messages, skipping duplicate request`);
      return;
    }
    
    logger.log(`DMS: DataManager: [${protocol.toUpperCase()}] Starting 3-stage process`);
    setProtocolLoading(prev => ({ ...prev, [protocol]: true }));
    
    try {
      await loadPastMessages(protocol);
      await queryMissedMessages(protocol);
      await startMessageSubscription(protocol);
      
      // Update last sync time for this protocol
      setLastSync(prev => ({ ...prev, [protocol]: Date.now() }));
      
      logger.log(`DMS: DataManager: [${protocol.toUpperCase()}] 3-stage process complete`);
    } catch (error) {
      logger.error(`DMS: DataManager: [${protocol.toUpperCase()}] Error in 3-stage process:`, error);
    } finally {
      setProtocolLoading(prev => ({ ...prev, [protocol]: false }));
    }
  }, [loadPastMessages, queryMissedMessages, startMessageSubscription, setLastSync]);

  // Main method to start message loading for all enabled protocols
  const startMessageLoading = useCallback(async () => {
    // Prevent multiple simultaneous executions
    if (isLoading) {
      logger.log('DMS: DataManager: Message loading already in progress, skipping duplicate request');
      return;
    }
    
    logger.log('DMS: DataManager: Starting message loading for all enabled protocols');
    setIsLoading(true);
    
    try {
      // Always load NIP-4 messages
      await loadMessagesForProtocol('nip4');
      
      // Load NIP-17 messages if enabled (regardless of sync status - this is initial load)
      if (settings.enableNIP17) {
        await loadMessagesForProtocol('nip17');
      }
      
      logger.log('DMS: DataManager: All protocol loading complete');
      setHasInitialLoadCompleted(true);
    } catch (error) {
      logger.error('DMS: DataManager: Error in message loading:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadMessagesForProtocol, isLoading]); // Remove settings dependency - it's handled in the function

  // Handle NIP-17 setting changes explicitly
  const handleNIP17SettingChange = useCallback(async (enabled: boolean) => {
    if (!userPubkey) {
      logger.log('DMS: DataManager: No user pubkey available for NIP-17 setting change');
      return;
    }
    
    if (enabled) {
      // User enabled NIP-17 - load messages now
      logger.log('DMS: DataManager: NIP-17 enabled by user, loading messages now');
      await loadMessagesForProtocol('nip17');
    } else {
      // User disabled NIP-17 - clear NIP-17 data and reset sync timestamp
      logger.log('DMS: DataManager: NIP-17 disabled by user, clearing data');
      setLastSync(prev => ({ ...prev, nip17: null }));
      
      // Clear NIP-17 messages from state
      setMessages(prev => {
        const newMap = new Map(prev);
        newMap.forEach((participant, key) => {
          if (participant.hasNIP17) {
            // Remove NIP-17 messages, keep NIP-4 messages
            const nip4Messages = participant.messages.filter(msg => msg.kind === 4);
            if (nip4Messages.length > 0) {
              newMap.set(key, {
                ...participant,
                messages: nip4Messages,
                hasNIP17: false,
                lastMessage: nip4Messages[0] || null,
                lastActivity: nip4Messages[0]?.created_at || 0,
              });
            } else {
              // No NIP-4 messages, remove participant entirely
              newMap.delete(key);
            }
          }
        });
        return newMap;
      });
      
      // persist to db, but wait for the state to be updated
      setTimeout(() => {
        writeAllMessagesToStore();
      }, 500);
    }
  }, []); // eslint-disable-next-line react-hooks/exhaustive-deps
  
  // Track previous NIP-17 setting to detect actual changes
  const prevNIP17Setting = useRef(settings.enableNIP17);
  
  // Watch for NIP-17 setting changes and handle them explicitly
  useEffect(() => {
    if (!hasInitialLoadCompleted) {
      // Don't handle setting changes until initial load is complete
      return;
    }
    
    // Only run if the setting actually changed (not on initial mount)
    if (prevNIP17Setting.current !== settings.enableNIP17) {
      logger.log('DMS: DataManager: NIP-17 setting changed from', prevNIP17Setting.current, 'to', settings.enableNIP17);
      handleNIP17SettingChange(settings.enableNIP17);
      prevNIP17Setting.current = settings.enableNIP17;
    }
  }, [settings.enableNIP17, hasInitialLoadCompleted, handleNIP17SettingChange]);

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

  // Debug method to write all current messages to IndexedDB
  const writeAllMessagesToStore = useCallback(async () => {
    if (!userPubkey) {
      logger.error('DMS: DataManager: No user pubkey available for writing to store');
      return;
    }

    try {
      const { writeMessagesToDB } = await import('@/lib/messageStore');
      
      // Convert current messages state to MessageStore format (same structure!)
      const messageStore = {
        participants: {} as Record<string, {
          messages: {
            id: string;
            pubkey: string;
            content: string;
            created_at: number;
            kind: number;
            tags: string[][];
            sig: string;
          }[];
          lastActivity: number;
          hasNIP4: boolean;
          hasNIP17: boolean;
        }>,
        lastSync: {
          nip4: lastSync.nip4,
          nip17: lastSync.nip17,
        }
      };
      
      messages.forEach((participant, participantPubkey) => {
        messageStore.participants[participantPubkey] = {
          messages: participant.messages.map(msg => ({
            id: msg.id,
            pubkey: msg.pubkey,
            content: msg.content,
            created_at: msg.created_at,
            kind: msg.kind,
            tags: msg.tags,
            sig: msg.sig,
          })),
          lastActivity: participant.lastActivity,
          hasNIP4: participant.hasNIP4,
          hasNIP17: participant.hasNIP17,
        };
      });

      await writeMessagesToDB(userPubkey, messageStore);
      logger.log(`DMS: DataManager: Successfully wrote message store to IndexedDB with ${Object.keys(messageStore.participants).length} participants`);
    } catch (error) {
              logger.error('DMS: DataManager: Error writing messages to IndexedDB:', error);
    }
  }, [messages, userPubkey, lastSync]);

  // Debug method to clear IndexedDB for current user
  const clearIndexedDB = useCallback(async () => {
    if (!userPubkey) {
      logger.error('DMS: DataManager: No user pubkey available for clearing store');
      return;
    }

    try {
      const { clearMessagesFromDB } = await import('@/lib/messageStore');
      await clearMessagesFromDB(userPubkey);
      
      // Clear local state
      setMessages(new Map());
      setLastSync({ nip4: null, nip17: null });
      setHasInitialLoadCompleted(false);
      
      logger.log('DMS: DataManager: Successfully cleared IndexedDB and reset state');
    } catch (error) {
      logger.error('DMS: DataManager: Error clearing IndexedDB:', error);
    }
  }, [userPubkey]);

  const contextValue: DataManagerContextType = {
    messages,
    isLoading,
    lastSync,
    conversations,
    getDebugInfo,
    writeAllMessagesToStore,
    clearIndexedDB,
    handleNIP17SettingChange,
    isDebugging: true, // Hardcoded for now
  };

  return (
    <DataManagerContext.Provider value={contextValue}>
      {children}
    </DataManagerContext.Provider>
  );
}
