import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useCanAccessChannel } from './useChannelPermissions';
import { useEventCache } from './useEventCache';
import { logger } from '@/lib/logger';
import type { NostrFilter, NPool } from '@nostrify/nostrify';
import type { NostrEvent } from '@/types/nostr';

// Consider messages "recent" if they're less than 10 seconds old
// This accounts for network delays while avoiding animating truly old messages
const RECENT_MESSAGE_THRESHOLD = 10000; // 10 seconds

function buildFilters(kind: string, pubkey: string, identifier: string, channelId: string): NostrFilter[] {
  const filters: NostrFilter[] = [];

  if (channelId === 'general') {
    // For general channel, query both kinds in one filter
    filters.push({
      kinds: [1, 9411], // Combined kinds for efficiency
      '#a': [`${kind}:${pubkey}:${identifier}`], // Community reference
      limit: 80, // Reduced limit for better performance
    });
  } else {
    // For specific channels, only query kind 9411 with channel tag
    filters.push({
      kinds: [9411],
      '#t': [channelId], // Channel identifier
      '#a': [`${kind}:${pubkey}:${identifier}`], // Community reference
      limit: 50,
    });
  }

  return filters;
}

export function validateMessageEvent(event: NostrEvent, expectedChannelId: string): boolean {
  // Combine all validation into a single pass with short-circuit evaluation
  return (
    // Check kind first (fastest check)
    ([1, 9411].includes(event.kind)) &&
    // Check for e-tags in one operation (no replies in main feed)
    (!event.tags.some(([name]) => name === 'e')) &&
    // Check channel tag only once with appropriate logic for each kind
    ((event.kind === 9411 && event.tags.some(([name, value]) => name === 't' && value === expectedChannelId)) ||
     (event.kind === 1 && (
       (expectedChannelId === 'general' && !event.tags.some(([name]) => name === 't')) ||
       event.tags.some(([name, value]) => name === 't' && value === expectedChannelId)
     )))
  );
}

// Export the queryFn for explicit reuse in preloaders
export async function fetchMessages(
  communityId: string, 
  channelId: string, 
  nostr: NPool, 
  cacheEvents: (events: NostrEvent[]) => void,
  signal?: AbortSignal
): Promise<NostrEvent[]> {
  const [kind, pubkey, identifier] = communityId.split(':');
  if (!kind || !pubkey || !identifier) return [];

  const filters = buildFilters(kind, pubkey, identifier, channelId);
  const events = await nostr.query(filters, { signal });

  if (events.length > 0) {
    cacheEvents(events);
  }

  const validEvents = events.filter(event => validateMessageEvent(event, channelId));
  return validEvents.sort((a, b) => a.created_at - b.created_at);
}

/**
 * Hook for loading messages from a community channel.
 * Provides message history + real-time updates as new messages arrive.
 */
export function useMessages(communityId: string, channelId: string) {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { canAccess: canRead } = useCanAccessChannel(communityId, channelId, 'read');
  const { cacheEvents } = useEventCache();
  
  const subscriptionRef = useRef<{ close: () => void } | null>(null);
  const queryKey = useMemo(() => ['messages', communityId, channelId], [communityId, channelId]);

  // Handle new real-time messages
  const handleNewMessage = useCallback((event: NostrEvent) => {
    if (!validateMessageEvent(event, channelId)) return;

    cacheEvents([event]);

    queryClient.setQueryData(queryKey, (oldMessages: NostrEvent[] | undefined) => {
      const now = Date.now();
      const eventAge = now - (event.created_at * 1000); // Convert to milliseconds
      const isRecentMessage = eventAge < RECENT_MESSAGE_THRESHOLD;
      
      if (!oldMessages) {
        // First message - only animate if it's recent
        return [{ ...event, clientFirstSeen: isRecentMessage ? now : undefined }];
      }
      
      // Skip if we already have this real message (not optimistic)
      if (oldMessages.some(msg => msg.id === event.id && !msg.isSending)) return oldMessages;
      
      // Check if this real message should replace an optimistic message
      // Look for optimistic messages with same content, author, and similar timestamp (within 30 seconds)
      const optimisticMessageIndex = oldMessages.findIndex(msg => 
        msg.isSending && 
        msg.pubkey === event.pubkey &&
        msg.content === event.content &&
        Math.abs(msg.created_at - event.created_at) <= 30 // 30 second window
      );

      if (optimisticMessageIndex !== -1) {
        // Replace the optimistic message with the real one (keep existing animation timestamp)
        const updatedMessages = [...oldMessages];
        const existingMessage = updatedMessages[optimisticMessageIndex];
        updatedMessages[optimisticMessageIndex] = { 
          ...event, 
          clientFirstSeen: existingMessage.clientFirstSeen // Preserve animation timestamp
        };
        logger.log(`[Messages] Replaced optimistic message with real message: ${event.id}`);
        return updatedMessages.sort((a, b) => a.created_at - b.created_at);
      }
      
      // No optimistic message to replace, add as new message (only animate if recent)
      return [...oldMessages, { ...event, clientFirstSeen: isRecentMessage ? now : undefined }].sort((a, b) => a.created_at - b.created_at);
    });

    logger.log(`[Messages] New message: ${event.id}`);
  }, [channelId, cacheEvents, queryClient, queryKey]);

  // Start real subscription
  const startSubscription = useCallback(async () => {
    if (!communityId || !channelId || !canRead) return;

    const [kind, pubkey, identifier] = communityId.split(':');
    if (!kind || !pubkey || !identifier) return;

    try {
      if (subscriptionRef.current) {
        subscriptionRef.current.close();
      }

      // Real-time subscription: ONLY new messages from now onwards
      // This avoids duplicates with initial query and provides true real-time updates
      const filters = buildFilters(kind, pubkey, identifier, channelId).map(filter => ({
        ...filter,
        since: Math.floor(Date.now() / 1000), // From NOW onwards (no historical overlap)
      }));

      logger.log(`[Messages] Starting subscription for ${channelId}`);

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
          logger.warn('Subscription error:', error);
        }
      })();

      subscriptionRef.current = {
        close: () => {
          isActive = false;
          logger.log(`[Messages] Subscription closed for ${channelId}`);
        }
      };

    } catch (error) {
      logger.error('Failed to start subscription:', error);
    }
  }, [communityId, channelId, canRead, nostr, handleNewMessage]);

  // Stop subscription
  const stopSubscription = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.close();
      subscriptionRef.current = null;
    }
  }, []);

  // Initial query for existing messages
  const query = useQuery({
    queryKey,
    queryFn: async (c) => {
      if (!canRead) return [];
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      return fetchMessages(communityId, channelId, nostr, cacheEvents, signal);
    },
    enabled: !!communityId && !!channelId && canRead,
    refetchInterval: false,
    // IMPORTANT: Clear messages when switching channels - don't show stale data
    placeholderData: undefined,
  });

  // Manage subscription lifecycle
  useEffect(() => {
    if (query.data && canRead) {
      startSubscription();
    }
    return stopSubscription;
  }, [query.data, canRead, startSubscription, stopSubscription]);

  // Handle tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopSubscription();
      } else if (document.visibilityState === 'visible' && query.data && canRead) {
        startSubscription();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopSubscription();
    };
  }, [query.data, canRead, startSubscription, stopSubscription]);

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    isSubscribed: !!subscriptionRef.current,
  };
}