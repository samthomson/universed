import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useCanAccessChannel } from './useChannelPermissions';
import { useEventCache } from './useEventCache';
import { useApprovedMembers } from './useApprovedMembers';
import { logger } from '@/lib/logger';
import type { NostrFilter, NPool } from '@nostrify/nostrify';
import type { NostrEvent } from '@/types/nostr';

// Consider messages "recent" if they're less than 10 seconds old
// This accounts for network delays while avoiding animating truly old messages
const RECENT_MESSAGE_THRESHOLD = 10000; // 10 seconds

// Number of messages to load per pagination request
const MESSAGES_PER_PAGE = 20; // Default number of messages to load per page

function buildFilters(
  kind: string, 
  pubkey: string, 
  identifier: string, 
  channelId: string,
  options: { 
    limit?: number; 
    until?: number; 
  } = {}
): NostrFilter[] {
  const filters: NostrFilter[] = [];
  const limit = options.limit || MESSAGES_PER_PAGE;
  
  // Add until parameter if provided (for pagination)
  const filterOptions: Record<string, unknown> = { limit };
  if (options.until) {
    filterOptions.until = options.until;
  }

  if (channelId === 'general') {
    // For general channel, query both kinds in one filter
    filters.push({
      kinds: [1, 9411], // Combined kinds for efficiency
      '#a': [`${kind}:${pubkey}:${identifier}`], // Community reference
      ...filterOptions,
    });
  } else {
    // For specific channels, only query kind 9411 with channel tag
    filters.push({
      kinds: [9411],
      '#t': [channelId], // Channel identifier
      '#a': [`${kind}:${pubkey}:${identifier}`], // Community reference
      ...filterOptions,
    });
  }

  return filters;
}

export function validateMessageEvent(
  event: NostrEvent,
  expectedChannelId: string,
  approvedMembers?: Set<string> | null
): boolean {
  // Combine all validation into a single pass with short-circuit evaluation
  const isValidEvent = (
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

  // If approvedMembers is null, no member filtering is applied (approval not required)
  if (approvedMembers === null) {
    return isValidEvent;
  }

  // If we have approved members list, also check if the author is approved
  if (isValidEvent && approvedMembers) {
    return approvedMembers.has(event.pubkey);
  }

  return isValidEvent;
}

// Export the queryFn for explicit reuse in preloaders
export async function fetchMessages(
  communityId: string,
  channelId: string,
  nostr: NPool,
  cacheEvents: (events: NostrEvent[]) => void,
  signal?: AbortSignal,
  approvedMembers?: Set<string> | null,
  options: { 
    limit?: number; 
    until?: number; 
  } = {}
): Promise<{ events: NostrEvent[], rawCount: number }> {
  const [kind, pubkey, identifier] = communityId.split(':');
  if (!kind || !pubkey || !identifier) return { events: [], rawCount: 0 };

  // Always use the options as provided
  const filters = buildFilters(kind, pubkey, identifier, channelId, options);
  const events = await nostr.query(filters, { signal });

  if (events.length > 0) {
    cacheEvents(events);
  }

  const validEvents = events.filter(event => validateMessageEvent(event, channelId, approvedMembers));
  return { 
    events: validEvents.sort((a, b) => a.created_at - b.created_at),
    rawCount: events.length
  };
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
  const { data: approvedMembers } = useApprovedMembers(communityId);

  const subscriptionRef = useRef<{ close: () => void } | null>(null);
  // Define both the base query key and the full query key
  const baseQueryKey = useMemo(() => ['messages', communityId, channelId], [communityId, channelId]);
  const queryKey = useMemo(() => [...baseQueryKey, approvedMembers?.size], 
    [baseQueryKey, approvedMembers?.size]);
  
  // Track the oldest message we have for pagination
  const [oldestMessageTimestamp, setOldestMessageTimestamp] = useState<number | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [reachedStartOfConversation, setReachedStartOfConversation] = useState(false);

  // Initial query for existing messages
  const query = useQuery({
    queryKey, // Using the full query key defined above
    queryFn: async (c) => {
      if (!canRead) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]); // 3s max for messages
      // Explicitly pass the limit to ensure we get the right number of messages
      const result = await fetchMessages(communityId, channelId, nostr, cacheEvents, signal, approvedMembers, { limit: MESSAGES_PER_PAGE });
      
      // If initial load has less than full page of raw messages, no more messages exist
      if (result.rawCount < MESSAGES_PER_PAGE) {
        setHasMoreMessages(false);
      }
      
      return result.events;
    },
    enabled: !!communityId && !!channelId && canRead && approvedMembers !== undefined,
    refetchInterval: false, // Use global staleTime from QueryOptimizer
    // IMPORTANT: Clear messages when switching channels - don't show stale data
    placeholderData: undefined,
    // This is critical - we need to return ALL messages, not just the first page
    select: (data) => {
      logger.log(`[DEBUG_PAGINATION] Query select function called with ${data.length} messages`);
      if (data.length > 0) {
        logger.log(`[DEBUG_PAGINATION] Select: First message: ${new Date(data[0].created_at * 1000).toISOString()}`);
        logger.log(`[DEBUG_PAGINATION] Select: Last message: ${new Date(data[data.length - 1].created_at * 1000).toISOString()}`);
      }
      return data;
    },
  });

  // Handle new real-time messages
  const handleNewMessage = useCallback((event: NostrEvent) => {
    if (!validateMessageEvent(event, channelId, approvedMembers)) return;

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
  }, [channelId, cacheEvents, queryClient, queryKey, approvedMembers]);

  // Start real subscription
  const startSubscription = useCallback(async () => {
    if (!communityId || !channelId || !canRead || approvedMembers === undefined) return;

    const [kind, pubkey, identifier] = communityId.split(':');
    if (!kind || !pubkey || !identifier) return;

    try {
      if (subscriptionRef.current) {
        subscriptionRef.current.close();
      }

      // Real-time subscription: Get messages from the most recent message we have
      // or from now if we don't have any messages
      let sinceTimestamp = Math.floor(Date.now() / 1000);
      
      // If we have messages, use the timestamp of the most recent one
      const existingMessages = queryClient.getQueryData<NostrEvent[]>(queryKey);
      logger.log(`[DEBUG_PAGINATION] Starting subscription with ${existingMessages?.length || 0} existing messages`);
      
      if (existingMessages && existingMessages.length > 0) {
        // Find the most recent message
        const mostRecent = existingMessages.reduce((latest, msg) => 
          msg.created_at > latest.created_at ? msg : latest, existingMessages[0]);
        
        // Use that timestamp + 1 second to avoid duplicate messages
        sinceTimestamp = mostRecent.created_at + 1;
        logger.log(`[DEBUG_PAGINATION] Subscription since: ${new Date(sinceTimestamp * 1000).toISOString()}`);
      }
      
      const filters = buildFilters(kind, pubkey, identifier, channelId).map(filter => ({
        ...filter,
        since: sinceTimestamp,
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
  }, [communityId, channelId, canRead, approvedMembers, nostr, handleNewMessage, queryClient, queryKey]);

  // Stop subscription
  const stopSubscription = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.close();
      subscriptionRef.current = null;
    }
  }, []);

  // Update oldest message timestamp when messages change
  useEffect(() => {
    if (query.data && query.data.length > 0) {
      // Find the oldest message
      const oldest = query.data.reduce((oldest, current) => 
        current.created_at < oldest.created_at ? current : oldest, query.data[0]);
      
      // Only update if it's older than what we have or we don't have one yet
      if (!oldestMessageTimestamp || oldest.created_at < oldestMessageTimestamp) {
        logger.log(`[DEBUG_PAGINATION] Updating oldest timestamp from ${oldestMessageTimestamp ? new Date(oldestMessageTimestamp * 1000).toISOString() : 'none'} to ${new Date(oldest.created_at * 1000).toISOString()}`);
        setOldestMessageTimestamp(oldest.created_at);
      }
    }
  }, [query.data, oldestMessageTimestamp]);

  // Load older messages function - completely rewritten
  const loadOlderMessages = useCallback(async () => {
    if (!communityId || !channelId || !canRead || !oldestMessageTimestamp || loadingOlderMessages) {
      logger.log(`[DEBUG_PAGINATION] Can't load older messages - conditions not met`);
      return;
    }

    setLoadingOlderMessages(true);
    logger.log(`[DEBUG_PAGINATION] Loading older messages before timestamp: ${new Date(oldestMessageTimestamp * 1000).toISOString()}`);

    try {
      // Get current messages from cache
      const currentMessages = queryClient.getQueryData<NostrEvent[]>(queryKey) || [];
      logger.log(`[DEBUG_PAGINATION] Current messages in cache: ${currentMessages.length}`);
      
      // Use the oldest message timestamp as the 'until' parameter
      const result = await fetchMessages(
        communityId,
        channelId,
        nostr,
        cacheEvents,
        undefined,
        approvedMembers,
        { 
          until: oldestMessageTimestamp - 1, // -1 to avoid getting the same message again
          limit: MESSAGES_PER_PAGE // Explicitly pass the limit
        }
      );

      const olderMessages = result.events;

      // If we got zero messages, we've definitely reached the end
      if (result.rawCount === 0) {
        logger.log(`[DEBUG_PAGINATION] Reached the end of history (got 0 raw messages)`);
        setHasMoreMessages(false);
        setReachedStartOfConversation(true);
      } else if (result.rawCount < MESSAGES_PER_PAGE) {
        // If we got fewer raw messages than requested, we've reached the end
        logger.log(`[DEBUG_PAGINATION] Got fewer raw messages (${result.rawCount}) than requested (${MESSAGES_PER_PAGE}), reached the end`);
        setHasMoreMessages(false);
      } else {
        // Got a full page of raw messages, assume there might be more
        logger.log(`[DEBUG_PAGINATION] Got full page of raw messages (${result.rawCount}), assuming there might be more`);
        setHasMoreMessages(true);
      }

      // Log for debugging
      logger.log(`[DEBUG_PAGINATION] Loaded ${olderMessages.length} older messages`);
      
      if (olderMessages.length > 0) {
        logger.log(`[DEBUG_PAGINATION] Oldest loaded: ${new Date(olderMessages[0].created_at * 1000).toISOString()}`);
        logger.log(`[DEBUG_PAGINATION] Newest loaded: ${new Date(olderMessages[olderMessages.length - 1].created_at * 1000).toISOString()}`);
        
        // Update the oldest timestamp if we found older messages
        const newOldest = olderMessages.reduce((oldest, current) => 
          current.created_at < oldest.created_at ? current : oldest, olderMessages[0]);
          
        if (newOldest.created_at < oldestMessageTimestamp) {
          logger.log(`[DEBUG_PAGINATION] Updating oldest timestamp to: ${new Date(newOldest.created_at * 1000).toISOString()}`);
          setOldestMessageTimestamp(newOldest.created_at);
        }
      }
      
      // If we didn't get any new messages, just return
      if (olderMessages.length === 0) {
        logger.log(`[DEBUG_PAGINATION] No older messages found`);
        return;
      }
      
      // Create a Set of existing message IDs for fast lookup
      const existingIds = new Set(currentMessages.map(msg => msg.id));
      
      // Log all message IDs for debugging
      logger.log(`[DEBUG_PAGINATION] Current message IDs: ${currentMessages.map(m => m.id.slice(0, 8)).join(', ')}`);
      logger.log(`[DEBUG_PAGINATION] Older message IDs: ${olderMessages.map(m => m.id.slice(0, 8)).join(', ')}`);
      
      // Filter out any duplicates
      const uniqueOlderMessages = olderMessages.filter(msg => !existingIds.has(msg.id));
      logger.log(`[DEBUG_PAGINATION] Unique older messages: ${uniqueOlderMessages.length}`);
      
      // If we got older messages but none are unique, that's a sign we need to go further back
      if (olderMessages.length > 0 && uniqueOlderMessages.length === 0) {
        logger.log(`[DEBUG_PAGINATION] Got ${olderMessages.length} older messages but none are unique - need to go further back`);
        
        // Try going back further by using the oldest timestamp from the older messages
        if (olderMessages.length > 0) {
          const oldestFetched = olderMessages.reduce((oldest, current) => 
            current.created_at < oldest.created_at ? current : oldest, olderMessages[0]);
          
          logger.log(`[DEBUG_PAGINATION] Setting oldest timestamp to ${new Date(oldestFetched.created_at * 1000).toISOString()}`);
          setOldestMessageTimestamp(oldestFetched.created_at);
        }
      }
      
      if (uniqueOlderMessages.length === 0) {
        logger.log(`[DEBUG_PAGINATION] No unique older messages to add`);
        return;
      }
      
      // Combine all messages and sort
      const allMessages = [...currentMessages, ...uniqueOlderMessages].sort((a, b) => a.created_at - b.created_at);
      logger.log(`[DEBUG_PAGINATION] Total messages after merge: ${allMessages.length}`);
      
      if (allMessages.length > 0) {
        logger.log(`[DEBUG_PAGINATION] First message after merge: ${new Date(allMessages[0].created_at * 1000).toISOString()}`);
        logger.log(`[DEBUG_PAGINATION] Last message after merge: ${new Date(allMessages[allMessages.length - 1].created_at * 1000).toISOString()}`);
      }
      
      // Update the cache with the new combined messages
      logger.log(`[DEBUG_PAGINATION] Updating query cache with ${allMessages.length} messages`);
      queryClient.setQueryData(queryKey, [...allMessages]);
      
    } catch (error) {
      logger.error('Failed to load older messages:', error);
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [
    communityId, 
    channelId, 
    canRead, 
    oldestMessageTimestamp, 
    loadingOlderMessages, 
    nostr, 
    cacheEvents, 
    approvedMembers, 
    queryClient, 
    queryKey
  ]);

  // Manage subscription lifecycle
  useEffect(() => {
    if (query.data && canRead && approvedMembers !== undefined) {
      startSubscription();
    }
    return stopSubscription;
  }, [query.data, canRead, approvedMembers, startSubscription, stopSubscription]);

  // Handle tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopSubscription();
      } else if (document.visibilityState === 'visible' && query.data && canRead && approvedMembers !== undefined) {
        startSubscription();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopSubscription();
    };
  }, [query.data, canRead, approvedMembers, startSubscription, stopSubscription]);

  // Log the current state for debugging
  logger.log(`[DEBUG_PAGINATION] Current state: hasMoreMessages=${hasMoreMessages}, loadingOlderMessages=${loadingOlderMessages}, messages=${query.data?.length || 0}`);

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    isSubscribed: !!subscriptionRef.current,
    hasMoreMessages,
    loadingOlderMessages,
    loadOlderMessages,
    reachedStartOfConversation,
  };
}