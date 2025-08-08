import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';

// NIP-51 Mute list kind
const MUTE_LIST_KIND = 10000;

/**
 * Hook to get the current user's mute list according to NIP-51
 * Uses kind 10000 for mute lists (standard replaceable event)
 */
export function useMutedUsers() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['muted-users', user?.pubkey],
    queryFn: async (c) => {
      if (!user) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      const events = await nostr.query([{
        kinds: [MUTE_LIST_KIND],
        authors: [user.pubkey],
        limit: 1,
      }], { signal });

      if (events.length === 0) return [];

      const muteEvent = events[0];
      // Extract pubkeys from 'p' tags according to NIP-51
      return muteEvent.tags
        .filter(([name]) => name === 'p')
        .map(([, pubkey]) => pubkey);
    },
    enabled: !!user,
    staleTime: 60000,
  });
}

/**
 * Check if a specific user is muted according to NIP-51
 */
export function useIsMuted(pubkey: string) {
  const { data: mutedUsers } = useMutedUsers();
  return mutedUsers?.includes(pubkey) || false;
}

// Deprecated functions - maintained for backward compatibility
// These will be removed in a future update
export function useBlockedUsers() {
  console.warn('useBlockedUsers is deprecated, use useMutedUsers instead');
  return useMutedUsers();
}

export function useIsBlocked(pubkey: string) {
  console.warn('useIsBlocked is deprecated, use useIsMuted instead');
  return useIsMuted(pubkey);
}