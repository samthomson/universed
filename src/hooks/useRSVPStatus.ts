import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import type { NostrEvent } from '@nostrify/nostrify';

export type RSVPStatus = 'accepted' | 'declined' | 'tentative';

interface RSVPStatusResult {
  status: RSVPStatus | null;
  rsvpEvent: NostrEvent | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to get the current user's RSVP status for a calendar event
 */
export function useRSVPStatus(calendarEvent: NostrEvent | null): RSVPStatusResult {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  const dTag = calendarEvent?.tags.find(tag => tag[0] === 'd')?.[1];
  const eventCoordinate = calendarEvent && dTag 
    ? `${calendarEvent.kind}:${calendarEvent.pubkey}:${dTag}` 
    : null;

  const query = useQuery({
    queryKey: ['rsvp-status', user?.pubkey, eventCoordinate],
    queryFn: async (c) => {
      if (!user?.pubkey || !eventCoordinate || !calendarEvent) {
        return { status: null, rsvpEvent: null };
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]);
      
      // Query for RSVP events (kind 31925) from current user for this calendar event
      const rsvpEvents = await nostr.query([{
        kinds: [31925],
        authors: [user.pubkey],
        '#a': [eventCoordinate],
        limit: 10, // Get recent RSVPs in case user changed their mind
      }], { signal });

      // Find the most recent RSVP event
      const mostRecentRSVP = rsvpEvents
        .sort((a, b) => b.created_at - a.created_at)[0];

      if (!mostRecentRSVP) {
        return { status: null, rsvpEvent: null };
      }

      // Extract status from the RSVP event
      const statusTag = mostRecentRSVP.tags.find(tag => tag[0] === 'status');
      const status = statusTag?.[1] as RSVPStatus;

      // Validate status is one of the expected values
      if (!['accepted', 'declined', 'tentative'].includes(status)) {
        return { status: null, rsvpEvent: null };
      }

      return {
        status,
        rsvpEvent: mostRecentRSVP,
      };
    },
    enabled: !!user?.pubkey && !!eventCoordinate && !!calendarEvent,
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: false,
  });

  return {
    status: query.data?.status || null,
    rsvpEvent: query.data?.rsvpEvent || null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}