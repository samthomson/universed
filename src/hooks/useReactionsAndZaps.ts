import { useReactionsAndZapsBatch } from './useReactionsAndZapsBatch';

/**
 * Hook for getting reactions and zaps for a single event.
 * This now uses the batch hook internally for better performance and code reuse.
 */
export function useReactionsAndZaps(eventId: string) {
  const { data: resultMap } = useReactionsAndZapsBatch([eventId]);

  return {
    data: resultMap?.get(eventId) || {
      reactions: [],
      zaps: [],
      zapCount: 0,
      totalSats: 0,
      reactionGroups: {},
    },
    isLoading: false, // Batch query handles loading
    error: null,
  };
}