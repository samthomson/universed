import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useCurrentUser } from './useCurrentUser';
import { logger } from '@/lib/logger';
import type { NostrEvent } from '@nostrify/nostrify';

// Number of DMs to load per pagination request
const DMS_PER_PAGE = 5;

// Consider messages "recent" if they're less than 10 seconds old
const RECENT_MESSAGE_THRESHOLD = 10000; // 10 seconds

// Extended NostrEvent type for optimistic updates
type ExtendedNostrEvent = NostrEvent & {
  isSending?: boolean;
  clientFirstSeen?: number;
};

interface DecryptedMessage {
  id: string;
  pubkey: string;
  created_at: number;
  content: string; // decrypted content
  kind: number;
  tags: NostrEvent["tags"];
  sig: string; // signature from original event
  direction: "sent" | "received";
  isSending?: boolean;
  clientFirstSeen?: number;
}

/**
 * Shared validation function for DM events
 */
export function validateDMEvent(event: NostrEvent): boolean {
  // Accept both NIP-04 (kind 4) and NIP-44 (kind 1059) encrypted DMs
  if (![4, 1059].includes(event.kind)) return false;

  // Must have a 'p' tag for the recipient
  const hasP = event.tags.some(([name]) => name === 'p');
  if (!hasP) return false;

  return true;
}

/**
 * Hook for loading DM messages for a specific conversation.
 * Provides message history + real-time updates as new messages arrive.
 * Works exactly like useMessages for channels.
 */
export function useDMMessages(conversationId: string) {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  const subscriptionRef = useRef<{ close: () => void } | null>(null);
  
  // Use memoized query key to prevent unnecessary re-renders
  const queryKey = useMemo(() => 
    user ? ['dm-messages', user!.pubkey, conversationId] : null, 
    [user, conversationId]
  );
  
  // Track the oldest message we have for pagination
  const [oldestMessageTimestamp, setOldestMessageTimestamp] = useState<number | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [reachedStartOfConversation, setReachedStartOfConversation] = useState(false);

  // Helper function to decrypt a single message
  const decryptSingleMessage = useCallback(async (message: ExtendedNostrEvent, currentUser: typeof user): Promise<DecryptedMessage | null> => {
    if (!currentUser || !currentUser.signer) return null;

    try {
      // Determine the other party's pubkey
      let otherPubkey: string;
      if (message.pubkey === currentUser.pubkey) {
        // We sent this message, find the recipient
        const pTag = message.tags.find(([name]) => name === "p");
        otherPubkey = pTag?.[1] || "";
      } else {
        // We received this message
        otherPubkey = message.pubkey;
      }

      if (!otherPubkey) {
        logger.error(`Could not determine conversation partner for message ${message.id}`);
        return null;
      }

      let decryptedContent: string;
      try {
        // Try NIP-44 decryption first (if available)
        if (currentUser.signer.nip44 && message.kind === 1059) {
          decryptedContent = await currentUser.signer.nip44.decrypt(
            otherPubkey,
            message.content,
          );
        } // Fall back to NIP-04 decryption
        else if (currentUser.signer.nip04 && message.kind === 4) {
          decryptedContent = await currentUser.signer.nip04.decrypt(
            otherPubkey,
            message.content,
          );
        } else {
          logger.error(`No decryption method available for message ${message.id}`);
          return null;
        }

        // Return decrypted message
        return {
          id: message.id,
          pubkey: message.pubkey,
          created_at: message.created_at,
          content: decryptedContent,
          kind: message.kind,
          tags: message.tags,
          sig: message.sig,
          direction: message.pubkey === currentUser.pubkey ? "sent" : "received",
          isSending: message.isSending,
          clientFirstSeen: message.clientFirstSeen,
        };
      } catch (error) {
        logger.error(`Failed to decrypt DM ${message.id}:`, error);
        return null;
      }
    } catch (error) {
      logger.error(`Error processing DM ${message.id}:`, error);
      return null;
    }
  }, []);

  // Initial query for existing DMs
  const query = useQuery<DecryptedMessage[]>({
    queryKey: queryKey || ['dm-messages-disabled'],
    queryFn: async (c) => {
      if (!user || !user.signer || !conversationId) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);

      // Query for DMs between the two users
      const dmEvents = await nostr.query([
        {
          kinds: [4, 1059], // DMs sent to us
          '#p': [user.pubkey],
          authors: [conversationId],
          limit: DMS_PER_PAGE,
        },
        {
          kinds: [4, 1059], // DMs sent by us
          authors: [user.pubkey],
          '#p': [conversationId],
          limit: DMS_PER_PAGE,
        }
      ], { signal });

      const validDMs = dmEvents.filter(validateDMEvent);

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

      // Update pagination state
      if (sortedMessages.length > 0) {
        const oldest = sortedMessages[0];
        setOldestMessageTimestamp(oldest.created_at);
        setHasMoreMessages(dmEvents.length >= DMS_PER_PAGE);
      }

      // Decrypt all messages
      const decryptedMessages: DecryptedMessage[] = [];
      
      for (const message of sortedMessages) {
        const decrypted = await decryptSingleMessage(message as ExtendedNostrEvent, user);
        if (decrypted) {
          decryptedMessages.push(decrypted);
        }
      }
      
      return decryptedMessages;
    },
    enabled: !!user && !!user.signer && !!conversationId && !!queryKey,
    placeholderData: undefined,
  });

  // Handle new real-time messages (EXACTLY like channels)
  const handleNewMessage = useCallback(async (event: NostrEvent) => {
    if (!validateDMEvent(event) || !user || !queryKey) return;

    // Check if this message is for this conversation
    const isFromUser = event.pubkey === user.pubkey;
    const isFromPartner = event.pubkey === conversationId;
    const recipientPTag = event.tags.find(([name]) => name === "p")?.[1] || "";
    const isToUser = recipientPTag === user.pubkey;
    const isToPartner = recipientPTag === conversationId;

    if (!((isFromUser && isToPartner) || (isFromPartner && isToUser))) return;

    // Decrypt the new message
    const decryptedEvent = await decryptSingleMessage(event as ExtendedNostrEvent, user);
    if (!decryptedEvent) return;

    queryClient.setQueryData(queryKey, (oldMessages: DecryptedMessage[] | undefined) => {
      const now = Date.now();
      const eventAge = now - (event.created_at * 1000);
      const isRecentMessage = eventAge < RECENT_MESSAGE_THRESHOLD;

      if (!oldMessages) {
        // First message - only animate if it's recent
        return [{
          ...decryptedEvent,
          clientFirstSeen: isRecentMessage ? now : undefined
        }];
      }

      // Skip if we already have this real message (not optimistic)
      if (oldMessages.some(msg => msg.id === event.id && !msg.isSending)) return oldMessages;

      // Check if this real message should replace an optimistic message
      // Look for optimistic messages with same content, author, and similar timestamp (within 30 seconds)
      const optimisticMessageIndex = oldMessages.findIndex(msg =>
        msg.isSending &&
        msg.pubkey === event.pubkey &&
        msg.content === decryptedEvent.content &&
        Math.abs(msg.created_at - event.created_at) <= 30 // 30 second window
      );

      if (optimisticMessageIndex !== -1) {
        // Replace the optimistic message with the real one (keep existing animation timestamp)
        const updatedMessages = [...oldMessages];
        const existingMessage = updatedMessages[optimisticMessageIndex];
        updatedMessages[optimisticMessageIndex] = {
          ...decryptedEvent,
          clientFirstSeen: existingMessage.clientFirstSeen // Preserve animation timestamp
        };
        logger.log(`[DMs] Replaced optimistic DM with real message: ${event.id}`);
        return updatedMessages.sort((a, b) => a.created_at - b.created_at);
      }

      // No optimistic message to replace, add as new message (only animate if recent)
      return [...oldMessages, {
        ...decryptedEvent,
        clientFirstSeen: isRecentMessage ? now : undefined
      }].sort((a, b) => a.created_at - b.created_at);
    });

    logger.log(`[DMs] New DM message: ${event.id}`);
  }, [user, conversationId, queryClient, queryKey, decryptSingleMessage]);

  // Start real-time subscription (exactly like channels)
  const startSubscription = useCallback(async () => {
    if (!user || !conversationId || !queryKey) return;

    try {
      if (subscriptionRef.current) {
        subscriptionRef.current.close();
      }

      // Real-time subscription: Get messages from the most recent message we have
      let sinceTimestamp = Math.floor(Date.now() / 1000);
      
      const existingMessages = queryClient.getQueryData<DecryptedMessage[]>(queryKey);
      if (existingMessages && existingMessages.length > 0) {
        const mostRecent = existingMessages.reduce((latest, msg) => 
          msg.created_at > latest.created_at ? msg : latest, existingMessages[0]);
        sinceTimestamp = mostRecent.created_at + 1;
      }

      const filters = [
        {
          kinds: [4, 1059],
          '#p': [user.pubkey],
          authors: [conversationId],
          since: sinceTimestamp,
        },
        {
          kinds: [4, 1059],
          authors: [user.pubkey],
          '#p': [conversationId],
          since: sinceTimestamp,
        }
      ];

      logger.log(`[DMs] Starting subscription for conversation ${conversationId}`);

      const subscription = nostr.req(filters);
      let isActive = true;

      // Process messages
      (async () => {
        try {
          for await (const msg of subscription) {
            if (!isActive) break;
            if (msg[0] === 'EVENT') {
              handleNewMessage(msg[2]);
            }
          }
        } catch (error) {
          logger.warn('DM subscription error:', error);
        }
      })();

      subscriptionRef.current = {
        close: () => {
          isActive = false;
          logger.log(`[DMs] Subscription closed for conversation ${conversationId}`);
        }
      };

    } catch (error) {
      logger.error('Failed to start DM subscription:', error);
    }
  }, [user, conversationId, nostr, handleNewMessage, queryClient, queryKey]);

  // Load older messages for pagination
  const loadOlderMessages = useCallback(async () => {
    if (!user || !user.signer || !conversationId || !oldestMessageTimestamp || loadingOlderMessages || !hasMoreMessages || !queryKey) {
      return;
    }

    setLoadingOlderMessages(true);

    try {
      const olderDMs = await nostr.query([
        {
          kinds: [4, 1059],
          '#p': [user.pubkey],
          authors: [conversationId],
          until: oldestMessageTimestamp - 1,
          limit: DMS_PER_PAGE,
        },
        {
          kinds: [4, 1059],
          authors: [user.pubkey],
          '#p': [conversationId],
          until: oldestMessageTimestamp - 1,
          limit: DMS_PER_PAGE,
        }
      ]);

      if (olderDMs.length === 0) {
        setHasMoreMessages(false);
        setReachedStartOfConversation(true);
        return;
      }

      // Update oldest timestamp
      const oldest = olderDMs.reduce((oldest, msg) => 
        msg.created_at < oldest.created_at ? msg : oldest, olderDMs[0]);
      setOldestMessageTimestamp(oldest.created_at);
      setHasMoreMessages(olderDMs.length >= DMS_PER_PAGE);

      // Decrypt older messages
      const decryptedOlder: DecryptedMessage[] = [];
      for (const message of olderDMs) {
        if (validateDMEvent(message)) {
          const decrypted = await decryptSingleMessage(message as ExtendedNostrEvent, user);
          if (decrypted) {
            decryptedOlder.push(decrypted);
          }
        }
      }

      // Update query data with older messages (like channels do)
      queryClient.setQueryData(queryKey, (currentMessages: DecryptedMessage[] | undefined) => {
        if (!currentMessages) return decryptedOlder;

        // Create a Set of existing message IDs for fast lookup
        const existingIds = new Set(currentMessages.map(msg => msg.id));
        
        // Filter out any duplicates
        const uniqueOlderMessages = decryptedOlder.filter(msg => !existingIds.has(msg.id));
        
        // Combine all messages and sort
        const allMessages = [...currentMessages, ...uniqueOlderMessages].sort((a, b) => a.created_at - b.created_at);
        
        return allMessages;
      });

    } catch (error) {
      logger.error('Failed to load older DMs:', error);
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [user, conversationId, nostr, oldestMessageTimestamp, loadingOlderMessages, hasMoreMessages, queryClient, queryKey, decryptSingleMessage]);

  // Start subscription when query succeeds
  useEffect(() => {
    if (query.data && user && conversationId) {
      startSubscription();
    }

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.close();
      }
    };
  }, [query.data, user, conversationId, startSubscription]);

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    hasMoreMessages,
    loadingOlderMessages,
    loadOlderMessages,
    reachedStartOfConversation,
  };
}