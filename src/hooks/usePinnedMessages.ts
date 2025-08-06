import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useNostrPublish } from './useNostrPublish';
import type { NostrEvent } from '@nostrify/nostrify';

const PINNED_POSTS_KIND = 34554;

// Helper function to extract channel ID from a message event
export function getMessageChannelId(message: NostrEvent): string | null {
  return message.tags.find(([name]) => name === 't')?.[1] || null;
}

export function usePinnedMessages(communityId: string, channelId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['pinned-messages', communityId, channelId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      const events = await nostr.query([{
        kinds: [PINNED_POSTS_KIND],
        '#d': [`${communityId}:${channelId}`],
        limit: 1,
      }], { signal });

      if (events.length === 0) return [];

      const pinnedEvent = events[0];
      return pinnedEvent.tags
        .filter(([name]) => name === 'e')
        .map(([, eventId]) => eventId);
    },
    enabled: !!communityId && !!channelId,
    // this tells react-query to ensure we clear messages when changing community/channel
    placeholderData: undefined
  });
}

export function usePinMessage() {
  const { mutate: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ communityId, channelId, messageId }: { communityId: string; channelId: string; messageId: string }) => {
      const currentPinned = queryClient.getQueryData<string[]>(['pinned-messages', communityId, channelId]) || [];

      if (currentPinned.includes(messageId)) {
        throw new Error('Message is already pinned');
      }

      const newTags = [
        ['d', `${communityId}:${channelId}`],
        ['t', channelId], // Add channel tag for filtering
        ['a', communityId], // Add community reference
        ...currentPinned.map(eventId => ['e', eventId]),
        ['e', messageId],
      ];

      createEvent({
        kind: PINNED_POSTS_KIND,
        content: '',
        tags: newTags,
      });
    },
    onSuccess: (_, { communityId, channelId }) => {
      queryClient.invalidateQueries({ queryKey: ['pinned-messages', communityId, channelId] });
    },
  });
}

export function useUnpinMessage() {
  const { mutate: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ communityId, channelId, messageId }: { communityId: string; channelId: string; messageId: string }) => {
      const currentPinned = queryClient.getQueryData<string[]>(['pinned-messages', communityId, channelId]) || [];

      const newTags = [
        ['d', `${communityId}:${channelId}`],
        ['t', channelId], // Add channel tag for filtering
        ['a', communityId], // Add community reference
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
    onSuccess: (_, { communityId, channelId }) => {
      queryClient.invalidateQueries({ queryKey: ['pinned-messages', communityId, channelId] });
    },
  });
}

export function useIsPinned(communityId: string, channelId: string, messageId: string) {
  const { data: pinnedMessages } = usePinnedMessages(communityId, channelId);
  return pinnedMessages?.includes(messageId) || false;
}

export function usePinnedMessageEvents(communityId: string, channelId: string) {
  const { nostr } = useNostr();
  const { data: pinnedMessageIds } = usePinnedMessages(communityId, channelId);

  return useQuery({
    queryKey: ['pinned-message-events', communityId, channelId, pinnedMessageIds],
    queryFn: async (c) => {
      if (!pinnedMessageIds || pinnedMessageIds.length === 0) {
        return [];
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      const events = await nostr.query([{
        ids: pinnedMessageIds,
      }], { signal });

      // Validate that the messages actually belong to this channel
      const validEvents = events.filter(event => {
        const eventChannelId = event.tags.find(([name]) => name === 't')?.[1];
        return eventChannelId === channelId;
      });

      // Sort by the order they appear in the pinned list (most recently pinned first)
      const sortedEvents = pinnedMessageIds
        .map(id => validEvents.find(event => event.id === id))
        .filter((event): event is NostrEvent => event !== undefined);

      return sortedEvents;
    },
    enabled: !!communityId && !!channelId && !!pinnedMessageIds && pinnedMessageIds.length > 0,
    placeholderData: undefined, // Force loading state when switching channels
  });
}