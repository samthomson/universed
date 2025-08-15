import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { validateDMEvent } from './useAllDMs';
import { logger } from '@/lib/logger';
import { reactQueryConfigs } from '@/lib/reactQueryConfigs';

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

// Constants for comprehensive scanning (internal to this hook)
const SCAN_TOTAL_LIMIT = 20000;  // Maximum total messages to process (increased from 5000)
const SCAN_BATCH_SIZE = 1000;    // Messages per batch request (increased from 500)  
const MESSAGES_PER_CHAT = 5;     // Recent messages to keep per conversation

/**
 * Hook for NIP-4 (Kind 4) direct messages.
 * Handles legacy encrypted DMs with efficient participant filtering.
 * Can also discover all conversations when isDiscoveryMode is true.
 */
export function useNIP4DirectMessages(conversationId: string, isDiscoveryMode = false) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  
  // Query for all NIP-4 messages (discovery mode) or specific conversation
  const query = useQuery({
    queryKey: isDiscoveryMode 
      ? ['nip4-all-conversations', user?.pubkey]
      : ['nip4-messages', user?.pubkey, conversationId],
    queryFn: async (c) => {
      if (!user) return isDiscoveryMode ? [] : { messages: [], conversations: [] };

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(15000)]); // Longer timeout for comprehensive scan

      if (isDiscoveryMode) {
        // Discovery mode: Comprehensive batched scanning
        logger.log(`[NIP4] Starting comprehensive scan (limit: ${SCAN_TOTAL_LIMIT}, batch: ${SCAN_BATCH_SIZE}) - Fresh fetch, not from cache`);
        
        let allDMs: NostrEvent[] = [];
        let processedMessages = 0;
        let oldestTimestamp: number | undefined;
        
        // Batch processing loop
        while (processedMessages < SCAN_TOTAL_LIMIT) {
          const batchLimit = Math.min(SCAN_BATCH_SIZE, SCAN_TOTAL_LIMIT - processedMessages);
          
          // Build filters for this batch
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
          
          logger.log(`[NIP4] Batch ${Math.floor(processedMessages / SCAN_BATCH_SIZE) + 1}: requesting ${batchLimit} messages`);
          
          const batchDMs = await nostr.query(filters, { signal });
          const validBatchDMs = batchDMs.filter(validateDMEvent);
          
          if (validBatchDMs.length === 0) {
            logger.log('[NIP4] No more messages available, stopping scan');
            break;
          }
          
          allDMs = [...allDMs, ...validBatchDMs];
          processedMessages += validBatchDMs.length;
          
          // Update oldest timestamp for next batch
          const batchOldest = validBatchDMs.reduce((oldest, dm) => 
            dm.created_at < oldest ? dm.created_at : oldest, 
            validBatchDMs[0]?.created_at || 0
          );
          oldestTimestamp = batchOldest - 1; // Subtract 1 to avoid overlap
          
          logger.log(`[NIP4] Batch complete: ${validBatchDMs.length} messages, total: ${allDMs.length}`);
          
          // Stop if we got fewer messages than requested (end of data)
          if (validBatchDMs.length < batchLimit) {
            logger.log('[NIP4] Reached end of available messages');
            break;
          }
        }
        
        // Group by conversation partner and keep recent messages
        const conversationMap = new Map<string, ConversationCandidate>();
        
        // Sort all messages by timestamp (newest first) for processing
        allDMs.sort((a, b) => b.created_at - a.created_at);
        
        // Process messages and decrypt them
        for (const dm of allDMs) {
          const isFromUser = dm.pubkey === user.pubkey;
          const recipientPTag = dm.tags.find(([name]) => name === 'p')?.[1];
          const otherPubkey = isFromUser ? recipientPTag : dm.pubkey;
          
          if (!otherPubkey || otherPubkey === user.pubkey) continue;
          
          // Decrypt the NIP-4 message content
          let decryptedContent: string;
          try {
            if (user.signer?.nip04) {
              decryptedContent = await user.signer.nip04.decrypt(otherPubkey, dm.content);
            } else {
              logger.error(`[NIP4] No NIP-04 decryption available for message ${dm.id}`);
              decryptedContent = '[No decryption method available]';
            }
          } catch (error) {
            logger.error(`[NIP4] Failed to decrypt message ${dm.id}:`, error);
            decryptedContent = '[Unable to decrypt message]';
          }
          
          // Create decrypted message
          const decryptedMessage: NostrEvent = {
            ...dm,
            content: decryptedContent,
          };
          
          const existing = conversationMap.get(otherPubkey);
          
          if (!existing) {
            // New conversation
            conversationMap.set(otherPubkey, {
              id: otherPubkey,
              pubkey: otherPubkey,
              lastMessage: decryptedMessage,
              lastActivity: dm.created_at,
              hasNIP4Messages: true,
              hasNIP17Messages: false,
              recentMessages: [decryptedMessage],
            });
          } else {
            // Existing conversation - add message if we have room
            if (existing.recentMessages.length < MESSAGES_PER_CHAT) {
              existing.recentMessages.push(decryptedMessage);
              // Keep messages sorted newest first
              existing.recentMessages.sort((a, b) => b.created_at - a.created_at);
            }
          }
        }
        
        const conversations = Array.from(conversationMap.values())
          .sort((a, b) => b.lastActivity - a.lastActivity);
          
        logger.log(`[NIP4] Comprehensive scan complete: ${conversations.length} conversations from ${allDMs.length} messages`);
        return conversations;
      } else {
        // Specific conversation mode - get NIP-4 messages for this conversation
        logger.log(`[DMCHAT] NIP4: Loading messages for conversation: "${conversationId}"`);
        logger.log(`[DMCHAT] NIP4: User pubkey: ${user.pubkey}`);

        // Query for NIP-4 DMs between the two users (ONLY kind 4, not 1059)
        const dmEvents = await nostr.query([
          {
            kinds: [4], // NIP-4 DMs sent to us
            '#p': [user.pubkey],
            authors: [conversationId],
            limit: 50,
          },
          {
            kinds: [4], // NIP-4 DMs sent by us
            authors: [user.pubkey],
            '#p': [conversationId],
            limit: 50,
          }
        ], { signal });

        logger.log(`[DMCHAT] NIP4: Raw DM events received: ${dmEvents.length}`);

        const validDMs = dmEvents.filter(validateDMEvent);
        logger.log(`[DMCHAT] NIP4: Valid DM events after filtering: ${validDMs.length}`);

        // Filter messages for this specific conversation
        const conversationMessages = validDMs.filter((event) => {
          const isFromUser = event.pubkey === user.pubkey;
          const isFromPartner = event.pubkey === conversationId;
          const recipientPTag = event.tags.find(([name]) => name === "p")?.[1] || "";
          const isToUser = recipientPTag === user.pubkey;
          const isToPartner = recipientPTag === conversationId;

          return (isFromUser && isToPartner) || (isFromPartner && isToUser);
        });

        // Deduplicate by event ID
        const uniqueMessages = Array.from(
          new Map(conversationMessages.map((event) => [event.id, event])).values(),
        );

        // Sort by created_at (oldest first for chronological order)
        const sortedMessages = uniqueMessages.sort((a, b) => a.created_at - b.created_at);

        // Decrypt all messages
        const decryptedMessages: NostrEvent[] = [];

        for (const message of sortedMessages) {
          let decryptedContent: string;
          try {
            if (user.signer?.nip04) {
              // Determine the other party's pubkey for decryption
              const isFromUser = message.pubkey === user.pubkey;
              const recipientPTag = message.tags.find(([name]) => name === 'p')?.[1];
              const otherPubkey = isFromUser ? recipientPTag : message.pubkey;

              if (otherPubkey) {
                decryptedContent = await user.signer.nip04.decrypt(otherPubkey, message.content);
              } else {
                decryptedContent = '[Unable to determine conversation partner]';
              }
            } else {
              decryptedContent = '[No NIP-04 decryption available]';
            }
          } catch (error) {
            logger.error(`[DMCHAT] NIP4: Failed to decrypt message ${message.id}:`, error);
            decryptedContent = '[Unable to decrypt message]';
          }

          // Create decrypted message
          const decryptedMessage: NostrEvent = {
            ...message,
            content: decryptedContent,
          };

          decryptedMessages.push(decryptedMessage);
        }

        logger.log(`[DMCHAT] NIP4: Final decrypted messages: ${decryptedMessages.length}`);
        if (decryptedMessages.length > 0) {
          logger.log(`[DMCHAT] NIP4: First message content: "${decryptedMessages[0].content}"`);
          logger.log(`[DMCHAT] NIP4: Last message content: "${decryptedMessages[decryptedMessages.length - 1].content}"`);
        }
        return decryptedMessages;
      }
    },
    enabled: !!user,
    ...reactQueryConfigs['dm-conversation-discovery'], // Use centralized config
  });

  // Log cache status for debugging
  if (isDiscoveryMode && query.data && !query.isLoading && Array.isArray(query.data)) {
    logger.log(`[NIP4] Using cached data: ${query.data.length} conversations found`);
  }

  // Return appropriate interface based on mode
  if (isDiscoveryMode) {
    return {
      conversations: query.data || [],
      isLoading: query.isLoading,
      isError: query.isError,
    };
  } else {
    // Specific conversation mode - return messages for this conversation
    const messages = Array.isArray(query.data) ? query.data : [];
    logger.log(`[DMCHAT] NIP4: Returning ${messages.length} messages, isLoading: ${query.isLoading}`);
    if (query.error) {
      logger.error(`[DMCHAT] NIP4: Query error:`, query.error);
    }
    return {
      messages,
      isLoading: query.isLoading,
      hasMoreMessages: false, // TODO: Implement pagination for individual chats
      loadingOlderMessages: false,
      loadOlderMessages: async () => {}, // TODO: Implement pagination
      reachedStartOfConversation: true,
    };
  }
}