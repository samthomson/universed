import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { logger } from '@/lib/logger';
import { validateReactionEvent, validateZapEvent } from '@/lib/eventValidation';
import { extractZapAmount } from '@/lib/zapUtils';
import type { ReactionsAndZapsResult } from '@/hooks/useReactionsAndZaps';

/**
 * Optimized hook for fetching reactions and zaps for multiple events in a single batch query.
 * This dramatically reduces network requests compared to individual useReactionsAndZaps calls.
 */
export function useReactionsAndZapsBatch(eventIds: string[]) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['reactions-and-zaps-batch', eventIds],
    queryFn: async (c) => {
      if (eventIds.length === 0) return new Map<string, ReactionsAndZapsResult>();

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]); // Moderate timeout for batch

      // Single query for all reactions and zaps
      const events = await nostr.query([{
        kinds: [7, 9735], // Reaction events and Zap receipts
        '#e': eventIds,
        limit: eventIds.length * 50, // Allow for many reactions/zaps per event
      }], { signal });

      // Create a map of event ID to reactions/zaps
      const resultMap = new Map<string, ReactionsAndZapsResult>();

      // Initialize with empty results for all requested event IDs
      eventIds.forEach(eventId => {
        resultMap.set(eventId, {
          reactions: [],
          zaps: [],
          zapCount: 0,
          totalSats: 0,
          reactionGroups: {},
        });
      });

      // Process events and group by target event ID
      events.forEach(event => {
        const targetEventId = event.tags.find(([name]) => name === 'e')?.[1];
        if (!targetEventId || !resultMap.has(targetEventId)) return;

        const result = resultMap.get(targetEventId)!;

        if (validateReactionEvent(event)) {
          result.reactions.push(event);

          // Group reactions by emoji
          const emoji = event.content || "👍";
          if (!result.reactionGroups[emoji]) {
            result.reactionGroups[emoji] = [];
          }
          result.reactionGroups[emoji].push(event);
        } else if (validateZapEvent(event)) {
          result.zaps.push(event);
          result.zapCount++;
          result.totalSats += extractZapAmount(event);
        }
      });

      // Sort reactions and zaps by created_at (newest first)
      resultMap.forEach(result => {
        result.reactions.sort((a, b) => b.created_at - a.created_at);
        result.zaps.sort((a, b) => b.created_at - a.created_at);
      });

      logger.log(`[ReactionsAndZapsBatch] Fetched reactions/zaps for ${eventIds.length} events in ${events.length} events`);
      return resultMap;
    },
    enabled: eventIds.length > 0,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 3 * 60 * 1000, // 3 minutes
  });
}

