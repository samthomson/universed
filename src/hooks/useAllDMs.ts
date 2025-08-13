import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { logger } from '@/lib/logger';
import type { NostrEvent } from '@nostrify/nostrify';

// Extended NostrEvent type for optimistic updates
type ExtendedNostrEvent = NostrEvent & {
  isSending?: boolean;
  clientFirstSeen?: number;
};

export interface DMConversation {
  id: string; // The other person's pubkey
  pubkey: string;
  lastMessage?: NostrEvent;
  lastMessageTime: number;
  unreadCount: number;
}

export interface AllDMsData {
  conversations: DMConversation[];
  allDMEvents: ExtendedNostrEvent[];
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

// Number of DMs to load per pagination request
const DMS_PER_PAGE = 5;

export function processAllDMs(allDMs: ExtendedNostrEvent[], userPubkey: string): AllDMsData {
      const validDMs = allDMs.filter(validateDMEvent);

      // Group by conversation (other person's pubkey)
      const conversationMap = new Map<string, DMConversation>();

      validDMs.forEach(dm => {
        // Determine the other person's pubkey
        let otherPubkey: string;
    if (dm.pubkey === userPubkey) {
          // We sent this DM, find the recipient
          const pTag = dm.tags.find(([name]) => name === 'p');
          otherPubkey = pTag?.[1] || '';
        } else {
          // We received this DM
          otherPubkey = dm.pubkey;
        }

        if (!otherPubkey) return;

        const existing = conversationMap.get(otherPubkey);
        if (!existing || dm.created_at > existing.lastMessageTime) {
          conversationMap.set(otherPubkey, {
            id: otherPubkey,
            pubkey: otherPubkey,
            lastMessage: dm,
            lastMessageTime: dm.created_at,
            unreadCount: 0, // TODO: Implement read status tracking
          });
        }
      });

      // Convert to array and sort by last message time
      const conversations = Array.from(conversationMap.values())
        .sort((a, b) => b.lastMessageTime - a.lastMessageTime);

      return {
        conversations,
    allDMEvents: validDMs.sort((a, b) => a.created_at - b.created_at),
  };
}

/**
 * Base hook that fetches all DM events and groups them by conversation
 * Now includes real-time subscription and pagination like channels
 */
export function useAllDMs() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const subscriptionRef = useRef<{ close: () => void } | null>(null);
  
  const queryKey = useMemo(() => ['all-dms', user?.pubkey], [user?.pubkey]);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [oldestMessageTimestamp, setOldestMessageTimestamp] = useState<number | null>(null);

  // Initial query for existing DMs
  const query = useQuery<AllDMsData>({
    queryKey,
    queryFn: async (c) => {
      if (!user) return { conversations: [], allDMEvents: [] };

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);

      // Single query to fetch recent DMs (both sent and received)
      const allDMs = await nostr.query([
        {
          kinds: [4, 1059], // DMs sent to us
          '#p': [user.pubkey],
          limit: DMS_PER_PAGE,
        },
        {
          kinds: [4, 1059], // DMs sent by us
          authors: [user.pubkey],
          limit: DMS_PER_PAGE,
        }
      ], { signal });

      const result = processAllDMs(allDMs, user.pubkey);
      
      // Track oldest message for pagination
      if (result.allDMEvents.length > 0) {
        const oldest = result.allDMEvents.reduce((oldest, msg) => 
          msg.created_at < oldest.created_at ? msg : oldest, result.allDMEvents[0]);
        setOldestMessageTimestamp(oldest.created_at);
        setHasMoreMessages(allDMs.length >= DMS_PER_PAGE);
      }

      return result;
    },
    enabled: !!user,
    select: (data) => {
      // Sort conversations by last message time
      const sortedConversations = [...data.conversations]
        .sort((a, b) => b.lastMessageTime - a.lastMessageTime);
      
      return {
        ...data,
        conversations: sortedConversations,
      };
    },
  });

  // Handle new real-time messages
  const handleNewMessage = useCallback((event: NostrEvent) => {
    if (!validateDMEvent(event) || !user) return;

    queryClient.setQueryData(queryKey, (oldData: AllDMsData | undefined) => {
      if (!oldData) return { conversations: [], allDMEvents: [event] };

      // Skip if we already have this real message (not optimistic)
      if (oldData.allDMEvents.some(msg => msg.id === event.id && !msg.isSending)) return oldData;

      // Check if this real message should replace an optimistic message
      // Look for optimistic messages with same author and similar timestamp (within 30 seconds)
      const optimisticMessageIndex = oldData.allDMEvents.findIndex(msg =>
        msg.isSending &&
        msg.pubkey === event.pubkey &&
        Math.abs(msg.created_at - event.created_at) <= 30 // 30 second window
      );

      let newAllDMEvents: ExtendedNostrEvent[];
      
      if (optimisticMessageIndex !== -1) {
        // Replace the optimistic message with the real one
        newAllDMEvents = [...oldData.allDMEvents];
        const existingMessage = newAllDMEvents[optimisticMessageIndex];
        newAllDMEvents[optimisticMessageIndex] = {
          ...event,
          clientFirstSeen: existingMessage.clientFirstSeen // Preserve animation timestamp
        };
        logger.log(`[DMs] Replaced optimistic DM with real message: ${event.id}`);
      } else {
        // No optimistic message to replace, add as new message
        const now = Date.now();
        const eventAge = now - (event.created_at * 1000);
        const isRecentMessage = eventAge < 10000; // 10 seconds threshold
        
        newAllDMEvents = [...oldData.allDMEvents, {
          ...event,
          clientFirstSeen: isRecentMessage ? now : undefined
        }];
      }

      return processAllDMs(newAllDMEvents.sort((a, b) => a.created_at - b.created_at), user.pubkey);
    });

    logger.log(`[DMs] New DM message: ${event.id}`);
  }, [user, queryClient, queryKey]);

  // Start real-time subscription
  const startSubscription = useCallback(async () => {
    if (!user) return;

    try {
      if (subscriptionRef.current) {
        subscriptionRef.current.close();
      }

      // Real-time subscription: Get messages from the most recent message we have
      let sinceTimestamp = Math.floor(Date.now() / 1000);
      
      const existingData = queryClient.getQueryData<AllDMsData>(queryKey);
      if (existingData && existingData.allDMEvents.length > 0) {
        const mostRecent = existingData.allDMEvents.reduce((latest, msg) => 
          msg.created_at > latest.created_at ? msg : latest, existingData.allDMEvents[0]);
        sinceTimestamp = mostRecent.created_at + 1;
      }

      const filters = [
        {
          kinds: [4, 1059],
          '#p': [user.pubkey],
          since: sinceTimestamp,
        },
        {
          kinds: [4, 1059],
          authors: [user.pubkey],
          since: sinceTimestamp,
        }
      ];

      logger.log(`[DMs] Starting subscription`);

      const subscription = nostr.req(filters);
      let isActive = true;

      // Process messages
      (async () => {
        try {
          for await (const message of subscription) {
            if (!isActive) break;
            if ('event' in message && message.event) {
              handleNewMessage(message.event as NostrEvent);
            }
          }
        } catch (error) {
          if (isActive) {
            logger.error('[DMs] Subscription error:', error);
          }
        }
      })();

      subscriptionRef.current = {
        close: () => {
          isActive = false;
          if (typeof subscription === 'object' && subscription && 'close' in subscription && typeof (subscription as { close?: () => void }).close === 'function') {
            (subscription as { close: () => void }).close();
          }
        },
      };
    } catch (error) {
      logger.error('[DMs] Failed to start subscription:', error);
    }
  }, [user, nostr, queryClient, queryKey, handleNewMessage]);

  // Load older messages for pagination
  const loadOlderMessages = useCallback(async () => {
    if (!user || !oldestMessageTimestamp || loadingOlderMessages || !hasMoreMessages) return;

    setLoadingOlderMessages(true);

    try {
      const olderDMs = await nostr.query([
        {
          kinds: [4, 1059],
          '#p': [user.pubkey],
          until: oldestMessageTimestamp,
          limit: DMS_PER_PAGE,
        },
        {
          kinds: [4, 1059],
          authors: [user.pubkey],
          until: oldestMessageTimestamp,
          limit: DMS_PER_PAGE,
        }
      ]);

      if (olderDMs.length === 0) {
        setHasMoreMessages(false);
        return;
      }

      queryClient.setQueryData(queryKey, (oldData: AllDMsData | undefined) => {
        if (!oldData) return { conversations: [], allDMEvents: [] };

        const allMessages = [...oldData.allDMEvents, ...olderDMs];
        const uniqueMessages = Array.from(
          new Map(allMessages.map(msg => [msg.id, msg])).values()
        );

        const result = processAllDMs(uniqueMessages, user.pubkey);
        
        // Update oldest timestamp
        if (result.allDMEvents.length > 0) {
          const oldest = result.allDMEvents.reduce((oldest, msg) => 
            msg.created_at < oldest.created_at ? msg : oldest, result.allDMEvents[0]);
          setOldestMessageTimestamp(oldest.created_at);
        }

        setHasMoreMessages(olderDMs.length >= DMS_PER_PAGE);
        return result;
      });
    } catch (error) {
      logger.error('[DMs] Failed to load older messages:', error);
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [user, nostr, oldestMessageTimestamp, loadingOlderMessages, hasMoreMessages, queryClient, queryKey]);

  // Start subscription when query succeeds and user is available
  useEffect(() => {
    if (query.data && user) {
      startSubscription();
    }

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.close();
      }
    };
  }, [query.data, user, startSubscription]);

  return {
    ...query,
    hasMoreMessages,
    loadingOlderMessages,
    loadOlderMessages,
  };
}