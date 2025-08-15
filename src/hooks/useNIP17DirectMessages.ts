import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { logger } from '@/lib/logger';
import { reactQueryConfigs } from '@/lib/reactQueryConfigs';
import { useEffect, useRef } from 'react';

import type { NostrEvent } from '@nostrify/nostrify';

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
  allMessages: Map<string, NostrEvent[]>; // pubkey -> messages for that conversation
}

// Constants for NIP-17 scanning (internal to this hook)
const SCAN_TOTAL_LIMIT = 20000;  // Maximum total messages to process
const SCAN_BATCH_SIZE = 1000;    // Messages per batch request
const _SUMMARY_MESSAGES_PER_CHAT = 5;    // Recent messages to show in conversation summaries (same as NIP-4)

/**
 * Hook for NIP-17 (Kind 14 wrapped in Kind 1059) direct messages.
 * Unlike NIP-4, this fetches ALL NIP-17 messages for the user and provides both:
 * 1. Conversation discovery (when isDiscoveryMode = true)
 * 2. Specific conversation messages (when conversationId is provided)
 */
export function useNIP17DirectMessages(conversationId: string, enabled: boolean, isDiscoveryMode = false) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const subscriptionRef = useRef<{ close: () => void } | null>(null);

  // Single comprehensive query that fetches ALL NIP-17 messages for this user
  const query = useQuery({
    queryKey: ['nip17-all-messages', user?.pubkey],
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
        try {
          if (!user.signer?.nip44) {
            continue;
          }

          // Step 1: Decrypt the Gift Wrap (Kind 1059) to get the Seal (Kind 13)
          const decryptedSealContent = await user.signer.nip44.decrypt(
            giftWrap.pubkey,
            giftWrap.content
          );
          
          const sealEvent = JSON.parse(decryptedSealContent) as NostrEvent;
          
          // Validate that we got a Seal (Kind 13)
          if (sealEvent.kind !== 13) {
            failedDecryption++;
            continue;
          }

          // Step 2: Decrypt the Seal to get the actual message (Kind 14)
          const decryptedMessageContent = await user.signer.nip44.decrypt(
            sealEvent.pubkey,
            sealEvent.content
          );
          
          const messageEvent = JSON.parse(decryptedMessageContent) as NostrEvent;
          
          // Validate that we got a Private DM (Kind 14)
          if (messageEvent.kind !== 14) {
            failedDecryption++;
            continue;
          }

          // Step 3: Extract conversation partner (author of the Seal)
          const conversationPartner = sealEvent.pubkey;
          
          if (!conversationPartner || conversationPartner === user.pubkey) {
            continue;
          }

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
          
        } catch (error) {
          // If JSON parsing failed, this might be a NIP-44 DM (not NIP-17 Gift Wrap)
          if (error instanceof SyntaxError && error.message.includes('not valid JSON')) {
            
            try {
              // This is a NIP-44 DM (Kind 1059) with direct message content
              const decryptedContent = await user.signer.nip44!.decrypt(
                giftWrap.pubkey,
                giftWrap.content
              );
              
              // For NIP-44 DMs, determine conversation partner
              let conversationPartner: string;
              if (giftWrap.pubkey === user.pubkey) {
                const pTag = giftWrap.tags.find(([name]) => name === 'p');
                conversationPartner = pTag?.[1] || '';
              } else {
                conversationPartner = giftWrap.pubkey;
              }
              
              if (!conversationPartner || conversationPartner === user.pubkey) {
                failedDecryption++;
                continue;
              }
              
              // Create a synthetic Kind 14 message from the NIP-44 DM
              const syntheticMessage: NostrEvent = {
                id: giftWrap.id,
                pubkey: giftWrap.pubkey,
                created_at: giftWrap.created_at,
                kind: 14,
                tags: giftWrap.tags,
                content: decryptedContent,
                sig: giftWrap.sig,
              };
              
              // Store message
              const existingMessages = messageMap.get(conversationPartner) || [];
              existingMessages.push(syntheticMessage);
              messageMap.set(conversationPartner, existingMessages);
              
              // Update conversation summary
              const existing = conversationMap.get(conversationPartner);
              if (!existing || syntheticMessage.created_at > existing.lastActivity) {
                const allMessagesForConvo = existingMessages.sort((a, b) => b.created_at - a.created_at);
                const summaryMessages = allMessagesForConvo.slice(0, _SUMMARY_MESSAGES_PER_CHAT);
                
                conversationMap.set(conversationPartner, {
                  id: conversationPartner,
                  pubkey: conversationPartner,
                  lastMessage: syntheticMessage,
                  lastActivity: syntheticMessage.created_at,
                  hasNIP4Messages: false,
                  hasNIP17Messages: true,
                  recentMessages: summaryMessages,
                });
              }
              
              decryptedCount++;
              
            } catch {
              failedDecryption++;
            }
          } else {
            failedDecryption++;
          }
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
        sinceTimestamp = mostRecent;
      }

      const subscriptionFilters = [{
        kinds: [1059], // NIP-17 Gift Wrap messages
        '#p': [user.pubkey], // We are the recipient
        since: sinceTimestamp,
      }];

      logger.log(`[NIP17] Starting real-time subscription for new Gift Wrap messages since ${sinceTimestamp}`);

      try {
        const subscription = nostr.req(subscriptionFilters);
        let isActive = true;

        // Process messages
        (async () => {
          try {
            for await (const message of subscription) {
              if (!isActive) break;
              logger.log(`[NIP17] Subscription received message:`, message);
              if (message[0] === 'EVENT') {
                const event = message[2];
                logger.log(`[NIP17] Processing new Gift Wrap event:`, event);
                
                try {
                  // TODO: Decrypt the Gift Wrap message and update conversations
                  // For now, just invalidate the query to trigger a refetch
                  queryClient.invalidateQueries({ queryKey: ['nip17-all-messages', user.pubkey] });
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
            logger.log('[NIP17] Subscription closed');
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
        logger.log('[NIP17] Closed subscription on cleanup');
      }
    };
  }, [user, enabled, query.data, nostr, queryClient]);

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

  // Return appropriate interface based on mode
  if (isDiscoveryMode) {
    return {
      conversations: Array.from(query.data?.conversations.values() || []),
      isLoading: query.isLoading,
      isError: query.isError,
    };
  } else {
    // Specific conversation mode - return messages for this conversation
    const conversationMessages = query.data?.allMessages.get(conversationId) || [];
    
    return {
      messages: conversationMessages,
      isLoading: query.isLoading,
      hasMoreMessages: false, // NIP-17 loads all messages at once
      loadingOlderMessages: false,
      loadOlderMessages: async () => {}, // No pagination needed since we have all messages
      reachedStartOfConversation: true,
    };
  }
}