import { useNostr } from "@nostrify/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";
import { logger } from "@/lib/logger";
import type { NostrEvent } from "@nostrify/nostrify";

interface RelayInfo {
  url: string;
  read: boolean;
  write: boolean;
}

/**
 * Hook to get user's relay list from their NIP-65 relay list event (kind 10002)
 */
function useUserRelays(pubkey?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['user-relays', pubkey],
    queryFn: async (c) => {
      if (!pubkey) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]);
      
      // Get the latest relay list (kind 10002) for the user
      const events = await nostr.query([{
        kinds: [10002],
        authors: [pubkey],
        limit: 1,
      }], { signal });

      if (events.length === 0) return [];

      const relayListEvent = events[0];
      
      // Extract relays from r tags
      const relays: RelayInfo[] = relayListEvent.tags
        .filter(([tagName]) => tagName === 'r')
        .map(([, url, marker]) => {
          const isRead = !marker || marker === 'read';
          const isWrite = !marker || marker === 'write';
          
          return {
            url,
            read: isRead,
            write: isWrite,
          };
        });

      return relays;
    },
    enabled: !!pubkey,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
  });
}

/**
 * Hook for publishing events to multiple relays based on the user's relay list
 */
export function useMultiRelayPublish() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { data: userRelays = [] } = useUserRelays(user?.pubkey);

  return useMutation({
    mutationFn: async (eventTemplate: Omit<NostrEvent, 'id' | 'pubkey' | 'sig'>) => {
      if (!user) {
        throw new Error("User is not logged in");
      }

      const tags = eventTemplate.tags ?? [];

      // Add the client tag if it doesn't exist
      if (location.protocol === "https:" && !tags.some(([name]) => name === "client")) {
        tags.push(["client", location.hostname]);
      }

      const event = await user.signer.signEvent({
        kind: eventTemplate.kind,
        content: eventTemplate.content ?? "",
        tags,
        created_at: eventTemplate.created_at ?? Math.floor(Date.now() / 1000),
      });

      // For now, use the default nostr.event() which should handle relay publishing
      // TODO: Implement proper multi-relay publishing when Nostrify supports it better
      await nostr.event(event, { signal: AbortSignal.timeout(5000) });
      
      // Log the relay information for debugging
      if (userRelays.length > 0) {
        const writeRelays = userRelays.filter(relay => relay.write);
        logger.log(`User has ${writeRelays.length} write relays configured:`, writeRelays.map(r => r.url));
      }
      return event;
    },
    onError: (error) => {
      logger.error("Failed to publish event to relays:", error);
    },
    onSuccess: (data) => {
      logger.log("Multi-relay event published successfully:", data);
    },
  });
}