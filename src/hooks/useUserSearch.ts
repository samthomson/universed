import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useFriends } from './useFriends';

interface ProfileMetadata {
  name?: string;
  display_name?: string;
  about?: string;
  nip05?: string;
  picture?: string;
}

function validateProfileEvent(event: NostrEvent): boolean {
  if (event.kind !== 0) return false;

  try {
    const metadata = JSON.parse(event.content);
    // Must have at least a name or display_name
    return !!(metadata.name || metadata.display_name);
  } catch {
    return false;
  }
}

export function useUserSearch(query: string) {
  const { nostr } = useNostr();
  const { data: friends } = useFriends();

  return useQuery({
    queryKey: ['user-search', query, friends?.map(f => f.pubkey).join(',')],
    queryFn: async (c) => {
      if (!query.trim()) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Get profile events for friends first (highest priority)
      const friendPubkeys = friends?.map(f => f.pubkey) || [];
      let friendEvents: NostrEvent[] = [];

      if (friendPubkeys.length > 0) {
        try {
          friendEvents = await nostr.query([
            {
              kinds: [0],
              authors: friendPubkeys,
              limit: friendPubkeys.length,
            }
          ], { signal: AbortSignal.any([c.signal, AbortSignal.timeout(2000)]) });
        } catch (error) {
          console.warn('Failed to fetch friend profiles:', error);
        }
      }

      // Search for other profiles that might match the query
      const searchEvents = await nostr.query([
        {
          kinds: [0], // Profile metadata
          limit: 100,
          since: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60), // Last 30 days
        }
      ], { signal });

      // Combine friend events and search events, removing duplicates
      const allEvents = [...friendEvents, ...searchEvents];
      const uniqueEvents = allEvents.filter((event, index, self) =>
        index === self.findIndex(e => e.pubkey === event.pubkey)
      );

      const validEvents = uniqueEvents.filter(validateProfileEvent);

      // Filter and score by search query
      const scoredUsers = validEvents
        .map(event => {
          try {
            const metadata = JSON.parse(event.content);
            const queryLower = query.toLowerCase();
            const isFriend = friendPubkeys.includes(event.pubkey);
            let score = 0;
            let matchType = '';

            // Friend boost (add 50 points to any match if user is followed)
            const friendBoost = isFriend ? 50 : 0;

            // Exact NIP-05 match (highest priority - score 100)
            if (metadata.nip05 && metadata.nip05.toLowerCase() === queryLower) {
              score = 100 + friendBoost;
              matchType = isFriend ? 'friend-exact-nip05' : 'exact-nip05';
            }
            // Partial NIP-05 match (high priority - score 80)
            else if (metadata.nip05 && metadata.nip05.toLowerCase().includes(queryLower)) {
              score = 80 + friendBoost;
              matchType = isFriend ? 'friend-partial-nip05' : 'partial-nip05';
            }
            // NIP-05 domain match (medium-high priority - score 60)
            else if (metadata.nip05) {
              const [_, domain] = metadata.nip05.split('@');
              if (domain && domain.toLowerCase().includes(queryLower)) {
                score = 60 + friendBoost;
                matchType = isFriend ? 'friend-domain-nip05' : 'domain-nip05';
              }
            }
            // Name match (medium priority - score 40)
            else if (metadata.name && metadata.name.toLowerCase().includes(queryLower)) {
              score = 40 + friendBoost;
              matchType = isFriend ? 'friend-name' : 'name';
            }
            // Display name match (medium priority - score 40)
            else if (metadata.display_name && metadata.display_name.toLowerCase().includes(queryLower)) {
              score = 40 + friendBoost;
              matchType = isFriend ? 'friend-display-name' : 'display-name';
            }
            // About text match (low priority - score 20)
            else if (metadata.about && metadata.about.toLowerCase().includes(queryLower)) {
              score = 20 + friendBoost;
              matchType = isFriend ? 'friend-about' : 'about';
            }

            // Special case: Show friends first even if they don't match the query well
            // This happens when query is empty or very short
            if (score === 0 && isFriend && queryLower.length <= 2) {
              score = 10 + friendBoost; // Base score for friends with short queries
              matchType = 'friend-short-query';
            }

            if (score > 0) {
              return { event, score, matchType, metadata, isFriend };
            }
          } catch {
            // Invalid metadata, skip
          }
          return null;
        })
        .filter(Boolean) as Array<{
          event: NostrEvent;
          score: number;
          matchType: string;
          metadata: ProfileMetadata;
          isFriend: boolean;
        }>;

      // Get unique pubkeys (highest score per user)
      const userMap = new Map<string, { event: NostrEvent; score: number; matchType: string; isFriend: boolean }>();
      scoredUsers.forEach(({ event, score, matchType, isFriend }) => {
        const existing = userMap.get(event.pubkey);
        if (!existing || score > existing.score || (score === existing.score && event.created_at > existing.event.created_at)) {
          userMap.set(event.pubkey, { event, score, matchType, isFriend });
        }
      });

      // Sort by score (descending), then by creation time (descending)
      const sortedUsers = Array.from(userMap.values())
        .sort((a, b) => {
          if (a.score !== b.score) {
            return b.score - a.score; // Higher score first
          }
          return b.event.created_at - a.event.created_at; // Newer profiles first
        });

      // Return just the pubkeys, limited to 20 results
      return sortedUsers
        .map(({ event }) => event.pubkey)
        .slice(0, 20);
    },
    enabled: !!query.trim(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}