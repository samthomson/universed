import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

export interface Community {
  id: string;
  name: string;
  description?: string;
  image?: string;
  banner?: string;
  creator: string;
  moderators: string[];
  relays: string[];
  event: NostrEvent;
}

function validateCommunityEvent(event: NostrEvent): boolean {
  if (event.kind !== 34550) return false;
  
  const d = event.tags.find(([name]) => name === 'd')?.[1];
  if (!d) return false;
  
  return true;
}

function parseCommunityEvent(event: NostrEvent): Community {
  const d = event.tags.find(([name]) => name === 'd')?.[1] || '';
  const name = event.tags.find(([name]) => name === 'name')?.[1] || d;
  const description = event.tags.find(([name]) => name === 'description')?.[1];
  const image = event.tags.find(([name]) => name === 'image')?.[1];
  const banner = event.tags.find(([name]) => name === 'banner')?.[1];
  
  const moderators = event.tags
    .filter(([name, , , role]) => name === 'p' && role === 'moderator')
    .map(([, pubkey]) => pubkey);
  
  const relays = event.tags
    .filter(([name]) => name === 'relay')
    .map(([, url]) => url);

  return {
    id: `${event.kind}:${event.pubkey}:${d}`,
    name,
    description,
    image,
    banner,
    creator: event.pubkey,
    moderators,
    relays,
    event,
  };
}

export function useCommunities() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['communities'],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      const events = await nostr.query([
        { kinds: [34550], limit: 100 }
      ], { signal });

      const validEvents = events.filter(validateCommunityEvent);
      return validEvents.map(parseCommunityEvent);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}