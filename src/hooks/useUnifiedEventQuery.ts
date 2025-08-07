import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useEventCache } from './useEventCache';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';

interface UnifiedEventData {
  messages: NostrEvent[];
  reactions: NostrEvent[];
  zaps: NostrEvent[];
  profiles: NostrEvent[];
  comments: NostrEvent[];
}

/**
 * BRUTAL OPTIMIZATION: Single query that fetches ALL event types for a community/channel
 * Eliminates 5+ separate queries into ONE efficient batch request
 */
export function useUnifiedEventQuery(communityId: string, channelId: string) {
  const { nostr } = useNostr();
  const { cacheEvents } = useEventCache();

  return useQuery<UnifiedEventData>({
    queryKey: ['unified-events', communityId, channelId],
    queryFn: async ({ signal }) => {
      const [kind, pubkey, identifier] = communityId.split(':');
      if (!kind || !pubkey || !identifier) {
        return { messages: [], reactions: [], zaps: [], profiles: [], comments: [] };
      }

      // SINGLE BRUTAL QUERY: Get ALL event types at once
      const filters: NostrFilter[] = [
        {
          // Messages + reactions + zaps + comments in ONE query
          kinds: [1, 9411, 7, 9735, 1111],
          '#a': [`${kind}:${pubkey}:${identifier}`],
          limit: 200, // Higher limit since we're combining queries
        }
      ];

      // Add channel filter for specific channels
      if (channelId !== 'general') {
        filters[0]['#t'] = [channelId];
      }

      const events = await nostr.query(filters, { 
        signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]) 
      });

      // Cache ALL events immediately
      if (events.length > 0) {
        cacheEvents(events);
      }

      // Separate by kind in JavaScript (MUCH faster than multiple queries)
      const messages = events.filter(e => [1, 9411].includes(e.kind));
      const reactions = events.filter(e => e.kind === 7);
      const zaps = events.filter(e => e.kind === 9735);
      const comments = events.filter(e => e.kind === 1111);

      // Extract unique authors for profile batch query
      const authorPubkeys = [...new Set(events.map(e => e.pubkey))];
      
      // SECOND QUERY: Batch fetch all profiles at once
      const profiles = authorPubkeys.length > 0 ? await nostr.query([{
        kinds: [0],
        authors: authorPubkeys,
        limit: authorPubkeys.length,
      }], { signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]) }) : [];

      if (profiles.length > 0) {
        cacheEvents(profiles);
      }

      return { messages, reactions, zaps, profiles, comments };
    },
    enabled: !!communityId && !!channelId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 15 * 1000, // 15 seconds
  });
}

/**
 * Extract specific data types from unified query
 */
export function useMessagesFromUnified(unifiedData: UnifiedEventData | undefined, channelId: string) {
  if (!unifiedData) return [];
  
  return unifiedData.messages
    .filter(event => {
      // Apply same validation as useMessages
      if (![1, 9411].includes(event.kind)) return false;
      if (event.tags.some(([name]) => name === 'e')) return false;
      
      if (event.kind === 9411) {
        const eventChannelId = event.tags.find(([name]) => name === 't')?.[1];
        return eventChannelId === channelId;
      }
      
      if (event.kind === 1) {
        const eventChannelId = event.tags.find(([name]) => name === 't')?.[1];
        if (channelId === 'general') return !eventChannelId;
        return eventChannelId === channelId;
      }
      
      return false;
    })
    .sort((a, b) => a.created_at - b.created_at);
}

export function useReactionsFromUnified(unifiedData: UnifiedEventData | undefined, eventId: string) {
  if (!unifiedData) return [];
  
  return unifiedData.reactions
    .filter(event => event.tags.some(([name, value]) => name === 'e' && value === eventId))
    .sort((a, b) => b.created_at - a.created_at);
}

export function useZapsFromUnified(unifiedData: UnifiedEventData | undefined, eventId: string) {
  if (!unifiedData) return [];
  
  return unifiedData.zaps
    .filter(event => event.tags.some(([name, value]) => name === 'e' && value === eventId))
    .sort((a, b) => b.created_at - a.created_at);
}

export function useProfilesFromUnified(unifiedData: UnifiedEventData | undefined) {
  if (!unifiedData) return new Map();
  
  const profileMap = new Map<string, NostrEvent>();
  unifiedData.profiles.forEach(profile => {
    profileMap.set(profile.pubkey, profile);
  });
  return profileMap;
}