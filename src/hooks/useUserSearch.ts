import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

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

  return useQuery({
    queryKey: ['user-search', query],
    queryFn: async (c) => {
      if (!query.trim()) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Search for profiles that might match the query
      // This is a basic implementation - in a real app you'd want a dedicated search relay
      const events = await nostr.query([
        {
          kinds: [0], // Profile metadata
          limit: 50,
          since: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60), // Last 30 days
        }
      ], { signal });

      const validEvents = events.filter(validateProfileEvent);
      
      // Filter by search query
      const matchingUsers = validEvents.filter(event => {
        try {
          const metadata = JSON.parse(event.content);
          const searchText = [
            metadata.name,
            metadata.display_name,
            metadata.about,
            metadata.nip05,
          ].filter(Boolean).join(' ').toLowerCase();
          
          return searchText.includes(query.toLowerCase());
        } catch {
          return false;
        }
      });

      // Get unique pubkeys (latest profile per user)
      const userMap = new Map<string, NostrEvent>();
      matchingUsers.forEach(event => {
        const existing = userMap.get(event.pubkey);
        if (!existing || event.created_at > existing.created_at) {
          userMap.set(event.pubkey, event);
        }
      });

      // Return just the pubkeys, sorted by profile creation time (newest first)
      return Array.from(userMap.values())
        .sort((a, b) => b.created_at - a.created_at)
        .map(event => event.pubkey)
        .slice(0, 20); // Limit to 20 results
    },
    enabled: !!query.trim(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}