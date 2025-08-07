import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { logger } from '@/lib/logger';

export type TraditionalStatus = "online" | "busy" | "away" | "offline";

export interface UserStatus {
  status?: TraditionalStatus;
  emoji?: string;
  message?: string;
  lastSeen?: number;
}

const USER_STATUS_KIND = 30315;

/**
 * Optimized hook for fetching user status for multiple users in a single batch query.
 * This reduces the number of network requests significantly compared to individual useUserStatus calls.
 */
export function useUserStatusBatch(pubkeys: string[]) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['user-status-batch', pubkeys],
    queryFn: async (c) => {
      if (pubkeys.length === 0) return new Map<string, UserStatus>();

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(2000)]); // Fast timeout for batch

      // Single query for all user statuses
      const events = await nostr.query([{
        kinds: [USER_STATUS_KIND],
        authors: pubkeys,
        '#d': ['status'],
        limit: pubkeys.length * 2, // Allow for multiple status events per user
      }], { signal });

      // Create a map of pubkey to status
      const statusMap = new Map<string, UserStatus>();

      // Initialize with default status for all requested pubkeys
      pubkeys.forEach(pubkey => {
        statusMap.set(pubkey, {
          lastSeen: Date.now(),
        });
      });

      // Process events and update the map
      events.forEach(event => {
        const pubkey = event.pubkey;
        const content = event.content || "";
        const statusTag = event.tags.find(([name]) => name === "status")?.[1];

        statusMap.set(pubkey, {
          status: statusTag as TraditionalStatus,
          emoji: content,
          message: event.tags.find(([name]) => name === "message")?.[1],
          lastSeen: event.created_at * 1000,
        });
      });

      logger.log(`[UserStatusBatch] Fetched statuses for ${pubkeys.length} users in ${events.length} events`);
      return statusMap;
    },
    enabled: pubkeys.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for getting a single user's status from the batch cache.
 * This should be used instead of useUserStatus when you have multiple users on the same page.
 */
export function useUserStatusFromBatch(pubkey: string, allPubkeys: string[]) {
  const { data: statusMap } = useUserStatusBatch(allPubkeys);
  
  return {
    data: statusMap?.get(pubkey) || null,
    isLoading: false, // Batch query handles loading
    error: null,
  };
}