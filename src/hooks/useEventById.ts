import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { nip19 } from 'nostr-tools';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';

interface UseEventByIdOptions {
  enabled?: boolean;
  staleTime?: number;
}

interface NaddrFilter extends NostrFilter {
  kinds: number[];
  authors: string[];
  '#d': string[];
}

interface NeventFilter extends NostrFilter {
  ids: string[];
  authors?: string[];
}

export function useEventById(
  eventId: string,
  options: UseEventByIdOptions = {}
) {
  const { nostr } = useNostr();

  return useQuery<NostrEvent | null>({
    queryKey: ['event-by-id', eventId],
    queryFn: async ({ signal }) => {
      try {
        // Try to decode as NIP-19 identifier first
        let decoded;
        try {
          decoded = nip19.decode(eventId);
        } catch {
          // If it's not a NIP-19 identifier, treat as hex ID
          decoded = null;
        }

        let filter;

        if (decoded) {
          // Handle NIP-19 identifiers
          switch (decoded.type) {
            case 'note':
              // note1 contains just the event ID
              filter = { ids: [decoded.data] };
              break;
            case 'nevent':
              // nevent1 contains event ID plus optional relay hints and author pubkey
              filter = {
                ids: [decoded.data.id],
                ...(decoded.data.author && { authors: [decoded.data.author] })
              };
              break;
            case 'naddr':
              // naddr1 is for addressable events
              filter = {
                kinds: [decoded.data.kind],
                authors: [decoded.data.pubkey],
                '#d': [decoded.data.identifier]
              };
              break;
            default:
              return null;
          }
        } else {
          // Treat as hex event ID
          filter = { ids: [eventId] };
        }

        const events = await nostr.query([filter], {
          signal: AbortSignal.any([signal, AbortSignal.timeout(3000)])
        });

        return events[0] || null;
      } catch (error) {
        console.error('Error fetching event by ID:', error);
        return null;
      }
    },
    enabled: options.enabled !== false && !!eventId,
    staleTime: options.staleTime || 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

// Helper hook to fetch multiple events by their IDs
export function useEventsByIds(
  eventIds: string[],
  options: UseEventByIdOptions = {}
) {
  const { nostr } = useNostr();

  return useQuery<NostrEvent[]>({
    queryKey: ['events-by-ids', eventIds],
    queryFn: async ({ signal }) => {
      if (eventIds.length === 0) return [];

      try {
        // Decode all event IDs and build filters
        const filters: NostrFilter[] = [];
        const hexIds: string[] = [];
        const neventFilters: NeventFilter[] = [];
        const naddrFilters: NaddrFilter[] = [];

        for (const id of eventIds) {
          try {
            const decoded = nip19.decode(id);

            switch (decoded.type) {
              case 'note':
                hexIds.push(decoded.data);
                break;
              case 'nevent':
                neventFilters.push({
                  ids: [decoded.data.id],
                  ...(decoded.data.author && { authors: [decoded.data.author] })
                });
                break;
              case 'naddr':
                naddrFilters.push({
                  kinds: [decoded.data.kind],
                  authors: [decoded.data.pubkey],
                  '#d': [decoded.data.identifier]
                });
                break;
            }
          } catch {
            // Treat as hex ID
            hexIds.push(id);
          }
        }

        // Build combined filters
        if (hexIds.length > 0) {
          filters.push({ ids: hexIds });
        }

        filters.push(...neventFilters as NostrFilter[]);
        filters.push(...naddrFilters as NostrFilter[]);

        if (filters.length === 0) return [];

        const events = await nostr.query(filters, {
          signal: AbortSignal.any([signal, AbortSignal.timeout(5000)])
        });

        return events;
      } catch (error) {
        console.error('Error fetching events by IDs:', error);
        return [];
      }
    },
    enabled: options.enabled !== false && eventIds.length > 0,
    staleTime: options.staleTime || 5 * 60 * 1000,
    retry: 1,
  });
}