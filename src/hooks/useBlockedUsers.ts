import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';

const USER_LIST_KIND = 30000;

export function useBlockedUsers() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['blocked-users', user?.pubkey],
    queryFn: async (c) => {
      if (!user) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      const events = await nostr.query([{
        kinds: [USER_LIST_KIND],
        authors: [user.pubkey],
        '#d': ['blocked'],
        limit: 1,
      }], { signal });

      if (events.length === 0) return [];

      const blockedEvent = events[0];
      return blockedEvent.tags
        .filter(([name]) => name === 'p')
        .map(([, pubkey]) => pubkey);
    },
    enabled: !!user,
    staleTime: 60000,
  });
}

export function useIsBlocked(pubkey: string) {
  const { data: blockedUsers } = useBlockedUsers();
  return blockedUsers?.includes(pubkey) || false;
}

export function useIsMuted(_pubkey: string) {
  // For now, just return false - can be implemented later
  return false;
}