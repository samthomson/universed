import { useQuery } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';

export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: 'text' | 'voice';
  communityId: string;
  creator: string;
  event: NostrEvent;
}

// For now, we'll use a simple approach with default channels
// In the future, this could be extended to use custom channel events
export function useChannels(communityId: string | null) {
  return useQuery({
    queryKey: ['channels', communityId],
    queryFn: async () => {
      if (!communityId) return [];

      // For now, return default channels for each community
      // This could be extended to query actual channel events
      const defaultChannels: Channel[] = [
        {
          id: 'general',
          name: 'general',
          description: 'General discussion',
          type: 'text',
          communityId,
          creator: '',
          event: {} as NostrEvent,
        },
        {
          id: 'random',
          name: 'random',
          description: 'Random chat',
          type: 'text',
          communityId,
          creator: '',
          event: {} as NostrEvent,
        },
        {
          id: 'voice-general',
          name: 'General',
          description: 'General voice chat',
          type: 'voice',
          communityId,
          creator: '',
          event: {} as NostrEvent,
        },
      ];

      return defaultChannels;
    },
    enabled: !!communityId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}