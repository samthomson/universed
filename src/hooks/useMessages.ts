import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCanAccessChannel } from './useChannelPermissions';
import { useEventCache } from './useEventCache';
import { useOptimizedEventLoading } from './useOptimizedEventLoading';
import { logger } from '@/lib/logger';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';

function buildMessageFilters(kind: string, pubkey: string, identifier: string, channelId: string): NostrFilter[] {
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

function validateMessageEvent(event: NostrEvent, expectedChannelId: string): boolean {
  // Accept kind 9411 (channel chat messages) and kind 1 (legacy)
  if (![1, 9411].includes(event.kind)) return false;

  // AGGRESSIVE FILTERING: Exclude ALL events with e-tags from main chat feed
  // This ensures thread replies never appear as top-level messages
  // Any event with e-tags (replies, mentions, etc.) is filtered out of the main feed
  const eTags = event.tags.filter(([name]) => name === 'e');
  if (eTags.length > 0) {
    return false; // Any event with e-tags is filtered out
  }

  // For kind 9411, we MUST have the correct channel tag
  if (event.kind === 9411) {
    const channelTag = event.tags.find(([name]) => name === 't')?.[1];
    if (!channelTag || channelTag !== expectedChannelId) {
      return false; // Message doesn't belong to this channel
    }
  }

  // For kind 1 (legacy), only allow if it has the correct channel tag OR no channel tag at all (for backward compatibility with general channel)
  if (event.kind === 1) {
    const channelTag = event.tags.find(([name]) => name === 't')?.[1];
    if (channelTag && channelTag !== expectedChannelId) {
      return false; // Message has a different channel tag
    }
    // If no channel tag and we're in general channel, allow it (legacy support)
    if (!channelTag && expectedChannelId !== 'general') {
      return false; // Untagged messages only go to general channel
    }
  }

  return true;
}

export function useMessages(communityId: string, channelId: string) {
  const { nostr } = useNostr();
  const { canAccess: canRead, reason } = useCanAccessChannel(communityId, channelId, 'read');
  const { cacheEvents } = useEventCache();
  const { preloadRelatedEvents } = useOptimizedEventLoading();

  // Debug logging
  logger.log(`[useMessages] Hook called for channel ${channelId}`);

  return useQuery({
    queryKey: ['messages', communityId, channelId],
    queryFn: async (c) => {
      // Check if user has read access to this channel
      if (!canRead) {
        logger.warn(`Access denied for channel ${channelId}: ${reason}`);
        return [];
      }

      // Parse community ID to get the components
      const [kind, pubkey, identifier] = communityId.split(':');

      if (!kind || !pubkey || !identifier) {
        return [];
      }

      // Build filters for the query
      const filters = buildMessageFilters(kind, pubkey, identifier, channelId);
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);

      // Simple direct query - let React Query handle caching
      const events = await nostr.query(filters, { signal });

      // Cache the fetched events for future use
      if (events.length > 0) {
        cacheEvents(events);
      }

      // Apply strict client-side filtering to ensure channel isolation
      const validEvents = events.filter(event => {
        const isValid = validateMessageEvent(event, channelId);

        // Additional safety check: ensure the event actually belongs to this channel
        if (isValid && event.kind === 9411) {
          const eventChannelId = event.tags.find(([name]) => name === 't')?.[1];
          if (eventChannelId !== channelId) {
            return false;
          }
        }

        return isValid;
      });

      // Sort by created_at (oldest first)
      const sortedEvents = validEvents.sort((a, b) => a.created_at - b.created_at);

      // Preload related events (reactions, comments) in the background
      if (sortedEvents.length > 0) {
        preloadRelatedEvents(communityId, sortedEvents);
      }

      logger.log(`[useMessages] Returning ${sortedEvents.length} messages for channel ${channelId}`);

      return sortedEvents;
    },
    enabled: !!communityId && !!channelId && canRead,
    refetchInterval: false,
    // REMOVED placeholderData to prevent stale replies from persisting
  });
}