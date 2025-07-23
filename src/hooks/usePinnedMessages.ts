import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useNostrPublish } from './useNostrPublish';

const PINNED_POSTS_KIND = 34554;

export function usePinnedMessages(communityId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['pinned-messages', communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      const events = await nostr.query([{
        kinds: [PINNED_POSTS_KIND],
        '#d': [communityId],
        limit: 1,
      }], { signal });

      if (events.length === 0) return [];

      const pinnedEvent = events[0];
      return pinnedEvent.tags
        .filter(([name]) => name === 'e')
        .map(([, eventId]) => eventId);
    },
    enabled: !!communityId,
    staleTime: 60000,
  });
}

export function usePinMessage() {
  const { mutate: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ communityId, messageId }: { communityId: string; messageId: string }) => {
      const currentPinned = queryClient.getQueryData<string[]>(['pinned-messages', communityId]) || [];

      if (currentPinned.includes(messageId)) {
        throw new Error('Message is already pinned');
      }

      const newTags = [
        ['d', communityId],
        ...currentPinned.map(eventId => ['e', eventId]),
        ['e', messageId],
      ];

      createEvent({
        kind: PINNED_POSTS_KIND,
        content: '',
        tags: newTags,
      });
    },
    onSuccess: (_, { communityId }) => {
      queryClient.invalidateQueries({ queryKey: ['pinned-messages', communityId] });
    },
  });
}

export function useUnpinMessage() {
  const { mutate: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ communityId, messageId }: { communityId: string; messageId: string }) => {
      const currentPinned = queryClient.getQueryData<string[]>(['pinned-messages', communityId]) || [];

      const newTags = [
        ['d', communityId],
        ...currentPinned
          .filter(eventId => eventId !== messageId)
          .map(eventId => ['e', eventId]),
      ];

      createEvent({
        kind: PINNED_POSTS_KIND,
        content: '',
        tags: newTags,
      });
    },
    onSuccess: (_, { communityId }) => {
      queryClient.invalidateQueries({ queryKey: ['pinned-messages', communityId] });
    },
  });
}

export function useIsPinned(communityId: string, messageId: string) {
  const { data: pinnedMessages } = usePinnedMessages(communityId);
  return pinnedMessages?.includes(messageId) || false;
}