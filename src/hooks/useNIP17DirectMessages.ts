import { useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { logger } from '@/lib/logger';
import { reactQueryConfigs } from '@/lib/reactQueryConfigs';
import { useEffect, useRef, useMemo } from 'react';

import type { NostrEvent } from '@/types/nostr';
import type { NUser } from '@nostrify/react/login';
import { PROTOCOL_CONSTANTS } from './useDirectMessages';

// Extended NostrEvent type for optimistic updates
interface OptimisticNostrEvent extends NostrEvent {
  isSending?: boolean;
  clientFirstSeen?: number;
}

interface ConversationCandidate {
  id: string;
  pubkey: string;
  lastMessage?: NostrEvent;
  lastActivity: number;
  hasNIP4Messages: boolean;
  hasNIP17Messages: boolean;
  recentMessages: NostrEvent[]; // Store recent messages for instant chat loading
}

interface NIP17MessageStore {
  conversations: Map<string, ConversationCandidate>;
  allMessages: Map<string, OptimisticNostrEvent[]>; // pubkey -> messages for that conversation (can include optimistic)
}

// Constants for NIP-17 scanning (internal to this hook)
const SCAN_TOTAL_LIMIT = 20000;  // Maximum total messages to process
const SCAN_BATCH_SIZE = 1000;    // Messages per batch request
const _SUMMARY_MESSAGES_PER_CHAT = 5;    // Recent messages to show in conversation summaries (same as NIP-4)

/**
 * Shared function to decrypt a NIP-17 Gift Wrap message
 * Returns the decrypted message and conversation partner, or null if failed
 */
async function decryptGiftWrapMessage(
  giftWrap: NostrEvent,
  user: NUser
): Promise<{ messageEvent: NostrEvent; conversationPartner: string } | null> {

  
  if (!user.signer?.nip44) {
    logger.error('[NIP17-DECRYPT] No NIP-44 signer available');
    return null;
  }

  try {
    // Step 1: Decrypt the Gift Wrap content
    const decryptedContent = await user.signer.nip44.decrypt(
      giftWrap.pubkey,
      giftWrap.content
    );
    
    // Step 2: Try to parse as JSON to determine if it's NIP-17 Gift Wrap
    let sealEvent: NostrEvent | null = null;
    try {
      sealEvent = JSON.parse(decryptedContent) as NostrEvent;
      if (sealEvent.kind !== 13) {
        logger.error('[NIP17-DECRYPT] Not a valid Seal (kind !== 13), got kind:', sealEvent.kind);
        return null; // Not a valid Seal
      }
    } catch (error) {
      logger.error('[NIP17-DECRYPT] Failed to parse seal JSON:', error);
      return null; // Not JSON or not a valid Seal
    }
  
  // Step 3: Decrypt the Seal to get the actual message (Kind 14)
  // The seal is encrypted by the seal author to the gift wrap recipient
  // So we decrypt using the seal author's pubkey
  const decryptedMessageContent = await user.signer.nip44.decrypt(
    sealEvent.pubkey,
    sealEvent.content
  );
  
  const messageEvent = JSON.parse(decryptedMessageContent) as NostrEvent;
    
  // Validate that we got a Private DM (Kind 14)
  if (messageEvent.kind !== 14) {
    logger.error('[NIP17-DECRYPT] Not a valid Private DM (kind !== 14), got kind:', messageEvent.kind);
    return null;
  }

  // Extract conversation partner
  // For received messages: conversation partner is the seal author (sender)
  // For sent messages: seal author is us, so get partner from the Private DM's p tag
  let conversationPartner: string;
  
  if (sealEvent.pubkey === user.pubkey) {
    // This is a message we sent - get recipient from Private DM's p tag
    const recipientPTag = messageEvent.tags.find(([name]) => name === 'p')?.[1];
    if (!recipientPTag || recipientPTag === user.pubkey) {
      logger.error('[NIP17-DECRYPT] Invalid recipient in sent message - p tag:', recipientPTag);
      return null; // Invalid recipient
    }
    conversationPartner = recipientPTag;
  } else {
    // This is a message we received - sender is the seal author
    conversationPartner = sealEvent.pubkey;
  }
  
  return { messageEvent, conversationPartner };
  } catch (error) {
    logger.error(`[NIP17] Failed to decrypt Gift Wrap message:`, error);
    return null;
  }
}

/**
 * Process a new Gift Wrap message from real-time subscription
 * Similar to handleNewMessage in useMessages.ts but for NIP-17 DMs
 */
async function processNewGiftWrapMessage(
  giftWrap: NostrEvent, 
  user: NUser, 
  queryClient: QueryClient
): Promise<void> {
  const decrypted = await decryptGiftWrapMessage(giftWrap, user);
  if (!decrypted) {
    logger.error('[NIP17-PROCESS] Failed to decrypt gift wrap:', giftWrap.id);
    return;
  }

  const { messageEvent, conversationPartner } = decrypted;

  // Update the cache directly (like channels do)
  queryClient.setQueryData([PROTOCOL_CONSTANTS.NIP17_MESSAGES_KEY, user.pubkey], (oldData: NIP17MessageStore | undefined) => {
    // Handle case where cache doesn't exist yet
    if (!oldData) {
      return {
        conversations: new Map([[conversationPartner, {
          id: conversationPartner,
          pubkey: conversationPartner,
          lastMessage: messageEvent,
          lastActivity: messageEvent.created_at,
          hasNIP4Messages: false,
          hasNIP17Messages: true,
          recentMessages: [messageEvent],
        }]]),
        allMessages: new Map([[conversationPartner, [messageEvent]]]),
      };
    }
    
    const updatedConversations = new Map(oldData.conversations);
    const updatedAllMessages = new Map(oldData.allMessages);
    
    // Add to full message history with optimistic update support
    const existingMessages = updatedAllMessages.get(conversationPartner) || [];
    
    // Check if this message already exists (prevent duplicates)
    const existingMessageIndex = existingMessages.findIndex(msg => msg.id === messageEvent.id);
    if (existingMessageIndex !== -1) {
      return oldData; // Return unchanged data
    }
    
    // Check if this real message should replace an optimistic message
    const optimisticMessageIndex = existingMessages.findIndex(msg =>
      msg.isSending &&
      msg.pubkey === messageEvent.pubkey &&
      msg.content === messageEvent.content &&
      Math.abs(msg.created_at - messageEvent.created_at) <= 30 // 30 second window
    );

    let newMessages: NostrEvent[];
    if (optimisticMessageIndex !== -1) {
      // Replace the optimistic message with the real one (preserve animation timestamp)
      logger.log(`[NIP17-PROCESS] Replacing optimistic message at index ${optimisticMessageIndex} with real message ${messageEvent.id}`);
      const updatedMessages = [...existingMessages];
      const existingMessage = updatedMessages[optimisticMessageIndex];
      updatedMessages[optimisticMessageIndex] = {
        ...messageEvent,
        clientFirstSeen: existingMessage.clientFirstSeen // Preserve animation timestamp
      };
      newMessages = updatedMessages.sort((a, b) => a.created_at - b.created_at);
    } else {
      // No optimistic message to replace, add as new message
      const now = Date.now();
      const eventAge = now - (messageEvent.created_at * 1000);
      const isRecentMessage = eventAge < 10000; // 10 seconds threshold
      
      newMessages = [...existingMessages, {
        ...messageEvent,
        clientFirstSeen: isRecentMessage ? now : undefined
      }].sort((a, b) => a.created_at - b.created_at);
    }
    
    updatedAllMessages.set(conversationPartner, newMessages);
    
    // Update conversation summary
    const existingConvo = updatedConversations.get(conversationPartner);
    if (existingConvo) {
      // Update existing conversation
      existingConvo.lastMessage = messageEvent;
      existingConvo.lastActivity = messageEvent.created_at;
      existingConvo.recentMessages = newMessages
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, _SUMMARY_MESSAGES_PER_CHAT);
    } else {
      // Create new conversation
      updatedConversations.set(conversationPartner, {
        id: conversationPartner,
        pubkey: conversationPartner,
        lastMessage: messageEvent,
        lastActivity: messageEvent.created_at,
        hasNIP4Messages: false,
        hasNIP17Messages: true,
        recentMessages: [messageEvent],
      });
    }
    
    return {
      conversations: updatedConversations,
      allMessages: updatedAllMessages,
    };
  });

  // Also invalidate the main discovery query to update the sidebar
  queryClient.invalidateQueries({ queryKey: ['dm-conversation-discovery'] });
}

/**
 * Hook for NIP-17 (Kind 14 wrapped in Kind 1059) direct messages.
 * Unlike NIP-4, this fetches ALL NIP-17 messages for the user and provides both:
 * 1. Conversation discovery (when isDiscoveryMode = true)
 * 2. Specific conversation messages (when conversationId is provided)
 */
export function useNIP17DirectMessages(conversationId: string, enabled: boolean, isDiscoveryMode = false, until?: number) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const subscriptionRef = useRef<{ close: () => void } | null>(null);

  // Single comprehensive query that fetches ALL NIP-17 messages for this user
  const query = useQuery({
    queryKey: [PROTOCOL_CONSTANTS.NIP17_MESSAGES_KEY, user?.pubkey],
    queryFn: async (c) => {
      if (!user) return { conversations: new Map(), allMessages: new Map() };

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(30000)]); // Longer timeout for NIP-17

      logger.log(`[NIP17] Starting comprehensive scan for all NIP-17 messages (limit: ${SCAN_TOTAL_LIMIT}, batch: ${SCAN_BATCH_SIZE}) - Fresh fetch, not from cache`);
      logger.log(`[NIP17] User pubkey: ${user.pubkey}, signer available: ${!!user.signer}, nip44 available: ${!!user.signer?.nip44}`);
      
      let allNIP17Events: NostrEvent[] = [];
      let processedMessages = 0;
      let oldestTimestamp: number | undefined;
      
      // Batch processing loop - fetch ALL NIP-17 messages for this user
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
        
        logger.log(`[NIP17] Batch ${Math.floor(processedMessages / SCAN_BATCH_SIZE) + 1}: requesting ${batchLimit} NIP-17 messages`);
        
        const batchEvents = await nostr.query(filters, { signal });
        
        if (batchEvents.length === 0) {
          logger.log('[NIP17] No more NIP-17 messages available, stopping scan');
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
        
        logger.log(`[NIP17] Batch complete: ${batchEvents.length} Gift Wrap messages, total: ${allNIP17Events.length}`);
        
        // Stop if we got fewer messages than requested (end of data)
        if (batchEvents.length < batchLimit) {
          logger.log('[NIP17] Reached end of available NIP-17 messages');
          break;
        }
      }
      
      // Now decrypt and process all NIP-17 messages
      const conversationMap = new Map<string, ConversationCandidate>();
      const messageMap = new Map<string, NostrEvent[]>(); // Store ALL decrypted messages per conversation
      let decryptedCount = 0;
      let failedDecryption = 0;
      
      logger.log(`[NIP17] Decrypting ${allNIP17Events.length} NIP-17 Gift Wrap messages...`);
      
      for (const giftWrap of allNIP17Events) {
        if (!user.signer?.nip44) {
          continue;
        }

        // Use shared decryption function
        const decrypted = await decryptGiftWrapMessage(giftWrap, user);
        
        if (decrypted) {
          // Process as NIP-17 Gift Wrap (Kind 1059 -> Kind 13 -> Kind 14)
          const { messageEvent, conversationPartner } = decrypted;

          // Store ALL decrypted messages for this conversation
          const existingMessages = messageMap.get(conversationPartner) || [];
          existingMessages.push(messageEvent);
          messageMap.set(conversationPartner, existingMessages);
          
          // Update conversation summary
          const existing = conversationMap.get(conversationPartner);
          if (!existing || messageEvent.created_at > existing.lastActivity) {
            const allMessagesForConvo = existingMessages.sort((a, b) => b.created_at - a.created_at);
            const summaryMessages = allMessagesForConvo.slice(0, _SUMMARY_MESSAGES_PER_CHAT);
            
            conversationMap.set(conversationPartner, {
              id: conversationPartner,
              pubkey: conversationPartner,
              lastMessage: messageEvent,
              lastActivity: messageEvent.created_at,
              hasNIP4Messages: false,
              hasNIP17Messages: true,
              recentMessages: summaryMessages,
            });
          }
          
          decryptedCount++;
        } else {
          // Not a valid NIP-17 Gift Wrap - skip
          failedDecryption++;
        }
      }
      
      logger.log(`[NIP17] Decryption complete: ${decryptedCount} successful, ${failedDecryption} failed`);
      logger.log(`[NIP17] Found ${conversationMap.size} NIP-17 conversations from ${allNIP17Events.length} Gift Wrap messages`);
      
      return {
        conversations: conversationMap,
        allMessages: messageMap,
      } as NIP17MessageStore;
    },
    enabled: !!user && enabled,
    ...reactQueryConfigs['dm-conversation-discovery'], // Use centralized config
  });

  // Log cache status for debugging
  if (query.data && !query.isLoading) {
    logger.log(`[NIP17] Using cached data: ${query.data.conversations.size} conversations found`);
  }

  // Real-time subscription for new NIP-17 messages
  useEffect(() => {
    if (!user || !enabled || !query.data) return;

    const startSubscription = async () => {
      // Cancel existing subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.close();
        logger.log('[NIP17] Closed existing subscription');
      }

      // Start subscription for new NIP-17 messages
      let sinceTimestamp = Math.floor(Date.now() / 1000);
      
      // Get most recent message timestamp from existing data
      const allConversations = Array.from(query.data.conversations.values());
      if (allConversations.length > 0) {
        const mostRecent = allConversations.reduce((latest, conv) => 
          conv.lastActivity > latest ? conv.lastActivity : latest, 0);
        // Subtract 60 seconds to ensure we don't miss messages due to optimistic updates
        sinceTimestamp = mostRecent - 60;
      }
      


      const subscriptionFilters = [{
        kinds: [1059], // NIP-17 Gift Wrap messages
        '#p': [user.pubkey], // We are the recipient
        since: sinceTimestamp,
      }];



      try {
        const subscription = nostr.req(subscriptionFilters);
        let isActive = true;
        const processedEventIds = new Set<string>(); // Track processed events to prevent duplicates

        // Process messages
        (async () => {
          try {
            for await (const message of subscription) {
              if (!isActive) break;
              if (message[0] === 'EVENT') {
                const event = message[2];
                
                // Skip if we've already processed this event
                if (processedEventIds.has(event.id)) {
                  continue;
                }
                processedEventIds.add(event.id);
                
                try {
                  // Decrypt and add new Gift Wrap message to cache (like channels do)
                  await processNewGiftWrapMessage(event, user, queryClient);
                } catch (error) {
                  logger.error(`[NIP17] Failed to process new Gift Wrap message:`, error);
                }
              }
            }
          } catch (error) {
            if (isActive) {
              logger.error('[NIP17] Subscription error:', error);
            }
          }
        })();

        subscriptionRef.current = {
          close: () => {
            isActive = false;
          }
        };
      } catch (error) {
        logger.error(`[NIP17] Failed to start subscription:`, error);
      }
    };

    startSubscription();

    // Cleanup on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.close();
      }
    };
  }, [user, enabled, query.data, nostr, queryClient]);

  // Return appropriate interface based on mode with memoized arrays
  return useMemo(() => {
    // Early return if not enabled
    if (!enabled) {
      return isDiscoveryMode ? {
        conversations: [],
        isLoading: false,
        isError: false,
      } : {
        messages: [],
        isLoading: false,
        hasMoreMessages: false,
        loadingOlderMessages: false,
        loadOlderMessages: async () => {},
        reachedStartOfConversation: false,
      };
    }

    if (isDiscoveryMode) {
      return {
        conversations: Array.from(query.data?.conversations.values() || []),
        isLoading: query.isLoading,
        isError: query.isError,
      };
    } else {
      // Specific conversation mode - return messages for this conversation with timestamp filtering
      const allConversationMessages = query.data?.allMessages.get(conversationId) || [];
      
      // Apply timestamp filter if provided
      const filteredMessages = until 
        ? allConversationMessages.filter(msg => msg.created_at < until)
        : allConversationMessages;
      
      // Sort by timestamp (oldest first) and take up to 100 messages
      const sortedMessages = filteredMessages
        .sort((a, b) => a.created_at - b.created_at)
        .slice(-100); // Take the 100 most recent messages before the 'until' timestamp
      
      logger.log(`[DMCHAT] NIP17: Conversation ${conversationId}, until: ${until}, total: ${allConversationMessages.length}, filtered: ${filteredMessages.length}, returned: ${sortedMessages.length}`);
      
      return {
        messages: sortedMessages,
        isLoading: query.isLoading,
        hasMoreMessages: filteredMessages.length > sortedMessages.length, // More available if we filtered some out
        loadingOlderMessages: false,
        loadOlderMessages: async () => {}, // Pagination is handled by the chat hook
        reachedStartOfConversation: filteredMessages.length <= sortedMessages.length,
      };
    }
  }, [enabled, isDiscoveryMode, query.data, query.isLoading, query.isError, conversationId, until]);
}