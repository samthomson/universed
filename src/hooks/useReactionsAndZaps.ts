import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { nip57 } from 'nostr-tools';

function validateReactionEvent(event: NostrEvent): boolean {
  if (event.kind !== 7) return false;
  const hasETag = event.tags.some(([name]) => name === 'e');
  if (!hasETag) return false;
  return true;
}

function validateZapEvent(event: NostrEvent): boolean {
  if (event.kind !== 9735) return false;
  const hasETag = event.tags.some(([name]) => name === 'e');
  if (!hasETag) return false;
  return true;
}

export interface ReactionsAndZapsResult {
  reactions: NostrEvent[];
  zaps: NostrEvent[];
  zapCount: number;
  totalSats: number;
  reactionGroups: Record<string, NostrEvent[]>;
}

export function useReactionsAndZaps(eventId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['reactions-and-zaps', eventId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);

      // Batch query for both reactions (kind 7) and zaps (kind 9735)
      const events = await nostr.query([
        {
          kinds: [7, 9735], // Reaction events and Zap receipts
          '#e': [eventId],
          limit: 200,
        }
      ], { signal });

      // Separate and validate events
      const reactions = events
        .filter(validateReactionEvent)
        .sort((a, b) => b.created_at - a.created_at);

      const zaps = events
        .filter(validateZapEvent)
        .sort((a, b) => b.created_at - a.created_at);

      // Calculate zap totals
      let zapCount = 0;
      let totalSats = 0;

      zaps.forEach(zap => {
        zapCount++;

        // Try multiple methods to extract the amount:
        // Method 1: amount tag (from zap request, sometimes copied to receipt)
        const amountTag = zap.tags.find(([name]) => name === 'amount')?.[1];
        if (amountTag) {
          const millisats = parseInt(amountTag);
          totalSats += Math.floor(millisats / 1000);
          return;
        }

        // Method 2: Extract from bolt11 invoice
        const bolt11Tag = zap.tags.find(([name]) => name === 'bolt11')?.[1];
        if (bolt11Tag) {
          try {
            const invoiceSats = nip57.getSatoshisAmountFromBolt11(bolt11Tag);
            totalSats += invoiceSats;
            return;
          } catch (error) {
            console.warn('Failed to parse bolt11 amount:', error);
          }
        }

        // Method 3: Parse from description (zap request JSON)
        const descriptionTag = zap.tags.find(([name]) => name === 'description')?.[1];
        if (descriptionTag) {
          try {
            const zapRequest = JSON.parse(descriptionTag);
            const requestAmountTag = zapRequest.tags?.find(([name]: string[]) => name === 'amount')?.[1];
            if (requestAmountTag) {
              const millisats = parseInt(requestAmountTag);
              totalSats += Math.floor(millisats / 1000);
              return;
            }
          } catch (error) {
            console.warn('Failed to parse description JSON:', error);
          }
        }

        console.warn('Could not extract amount from zap receipt:', zap.id);
      });

      // Group reactions by emoji
      const reactionGroups = reactions.reduce((acc, reaction) => {
        const emoji = reaction.content || "👍";
        if (!acc[emoji]) {
          acc[emoji] = [];
        }
        acc[emoji].push(reaction);
        return acc;
      }, {} as Record<string, NostrEvent[]>);

      const result: ReactionsAndZapsResult = {
        reactions,
        zaps,
        zapCount,
        totalSats,
        reactionGroups,
      };

      return result;
    },
    enabled: !!eventId,
    refetchInterval: 30 * 1000, // 30 seconds
  });
}