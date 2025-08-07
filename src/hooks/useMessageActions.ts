import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';
import { useCanModerate } from './useCommunityRoles';
import type { NostrEvent } from '@nostrify/nostrify';

const DELETION_KIND = 5;

export function useDeleteMessage(communityId?: string) {
  const { mutateAsync: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { canModerate } = useCanModerate(communityId || '');

  return useMutation({
    mutationFn: async ({ messageEvent, reason }: { messageEvent: NostrEvent; reason?: string }) => {
      if (!user) {
        throw new Error('You must be logged in to delete messages');
      }

      const isOwnMessage = messageEvent.pubkey === user.pubkey;
      const canModerateMessage = communityId && canModerate;

      if (!isOwnMessage && !canModerateMessage) {
        throw new Error('You can only delete your own messages or moderate community messages');
      }

      const tags = [
        ['e', messageEvent.id],
        ['k', messageEvent.kind.toString()],
      ];

      // Add community context if this is a moderation action
      if (communityId && canModerateMessage && !isOwnMessage) {
        tags.push(['a', communityId]);
        tags.push(['action', 'moderate-delete']);
        if (reason) {
          tags.push(['reason', reason]);
        }
      }

      await createEvent({
        kind: DELETION_KIND,
        content: reason || (isOwnMessage ? 'Message deleted' : 'Message deleted by moderator'),
        tags,
      });
    },
    onMutate: async ({ messageEvent }) => {
      // Cancel any outgoing refetches for messages
      await queryClient.cancelQueries({ queryKey: ['messages'] });

      // Get the current messages from all relevant queries
      const queriesData = queryClient.getQueriesData({ queryKey: ['messages'] });

      // Snapshot the previous messages
      const previousMessagesByQuery = new Map();
      queriesData.forEach(([queryKey, messages]) => {
        if (Array.isArray(messages)) {
          previousMessagesByQuery.set(queryKey, messages);
        }
      });

      // Optimistically remove the message from all message queries
      queriesData.forEach(([queryKey]) => {
        queryClient.setQueryData(queryKey, (old: NostrEvent[] | undefined) => {
          if (!Array.isArray(old)) return old;
          return old.filter(message => message.id !== messageEvent.id);
        });
      });

      // Return context for rollback
      return { previousMessagesByQuery, deletedMessageId: messageEvent.id };
    },
    onError: (error, variables, context) => {
      // If the mutation fails, restore the messages
      if (context?.previousMessagesByQuery) {
        context.previousMessagesByQuery.forEach((messages, queryKey) => {
          queryClient.setQueryData(queryKey, messages);
        });
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we're in sync
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['moderation-logs'] });
    },
  });
}

export function useEditMessage() {
  const { mutateAsync: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ originalEvent, newContent }: { originalEvent: NostrEvent; newContent: string }) => {
      if (!user || originalEvent.pubkey !== user.pubkey) {
        throw new Error('You can only edit your own messages');
      }

      if (originalEvent.kind === 9411) {
        const originalTags = originalEvent.tags.filter(([name]) =>
          ['t', 'a', 'e', 'p'].includes(name)
        );

        await createEvent({
          kind: 9411,
          content: newContent,
          tags: [
            ...originalTags,
            ['e', originalEvent.id, '', 'edit'],
          ],
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export interface BulkDeleteMessagesParams {
  messageEvents: NostrEvent[];
  communityId?: string;
  reason?: string;
}

export function useBulkDeleteMessages(communityId?: string) {
  const { mutateAsync: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { canModerate } = useCanModerate(communityId || '');

  return useMutation({
    mutationFn: async ({ messageEvents, reason }: { messageEvents: NostrEvent[]; reason?: string }) => {
      if (!user) {
        throw new Error('You must be logged in to delete messages');
      }

      if (!canModerate && communityId) {
        throw new Error('Only moderators and admins can bulk delete messages');
      }

      // Create a single deletion event for multiple messages
      const tags = [
        ...messageEvents.map(event => ['e', event.id]),
        ['k', '9411'], // Assuming community messages are kind 9411
      ];

      if (communityId) {
        tags.push(['a', communityId]);
        tags.push(['action', 'bulk-moderate-delete']);
        if (reason) {
          tags.push(['reason', reason]);
        }
      }

      await createEvent({
        kind: DELETION_KIND,
        content: reason || `Bulk deletion of ${messageEvents.length} messages by moderator`,
        tags,
      });
    },
    onMutate: async ({ messageEvents }) => {
      // Cancel any outgoing refetches for messages
      await queryClient.cancelQueries({ queryKey: ['messages'] });

      // Get the current messages from all relevant queries
      const queriesData = queryClient.getQueriesData({ queryKey: ['messages'] });

      // Snapshot the previous messages
      const previousMessagesByQuery = new Map();
      queriesData.forEach(([queryKey, messages]) => {
        if (Array.isArray(messages)) {
          previousMessagesByQuery.set(queryKey, messages);
        }
      });

      // Get the IDs of messages to delete
      const deletedMessageIds = messageEvents.map(event => event.id);

      // Optimistically remove the messages from all message queries
      queriesData.forEach(([queryKey]) => {
        queryClient.setQueryData(queryKey, (old: NostrEvent[] | undefined) => {
          if (!Array.isArray(old)) return old;
          return old.filter(message => !deletedMessageIds.includes(message.id));
        });
      });

      // Return context for rollback
      return { previousMessagesByQuery, deletedMessageIds };
    },
    onError: (error, variables, context) => {
      // If the mutation fails, restore the messages
      if (context?.previousMessagesByQuery) {
        context.previousMessagesByQuery.forEach((messages, queryKey) => {
          queryClient.setQueryData(queryKey, messages);
        });
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we're in sync
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['moderation-logs'] });
    },
  });
}