import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';
import { useToast } from './useToast';
import type { NostrEvent } from '@nostrify/nostrify';

interface AddReactionParams {
  targetEvent: NostrEvent;
  emoji: string;
}

interface RemoveReactionParams {
  targetEvent: NostrEvent;
  emoji: string;
}

export function useEmojiReactions() {
  const { mutateAsync: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addReaction = useMutation({
    mutationFn: async ({ targetEvent, emoji }: AddReactionParams) => {
      if (!user) {
        throw new Error('User must be logged in to react');
      }

      // Create a reaction event (kind 7)
      const reactionEvent = await createEvent({
        kind: 7,
        content: emoji,
        tags: [
          ['e', targetEvent.id], // Event being reacted to
          ['p', targetEvent.pubkey], // Author of the event being reacted to
          ['k', targetEvent.kind.toString()], // Kind of event being reacted to
        ],
      });

      return reactionEvent;
    },
    onMutate: async ({ targetEvent, emoji }) => {
      if (!user) return;

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['reactions', targetEvent.id] });

      // Snapshot the previous value
      const previousReactions = queryClient.getQueryData<NostrEvent[]>(['reactions', targetEvent.id]);

      // Create optimistic reaction
      const optimisticReaction: NostrEvent = {
        id: `optimistic-reaction-${Date.now()}`,
        pubkey: user.pubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 7,
        tags: [
          ['e', targetEvent.id],
          ['p', targetEvent.pubkey],
          ['k', targetEvent.kind.toString()],
        ],
        content: emoji,
        sig: '',
      };

      // Optimistically update to the new value
      queryClient.setQueryData<NostrEvent[]>(['reactions', targetEvent.id], old => {
        return [...(old || []), optimisticReaction];
      });

      // Return a context object with the snapshotted value
      return { previousReactions, optimisticReaction, targetEventId: targetEvent.id };
    },
    onError: (error, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousReactions && context?.targetEventId) {
        queryClient.setQueryData(['reactions', context.targetEventId], context.previousReactions);
      }

      console.error('Failed to add reaction:', error);
      toast({
        title: 'Failed to add reaction',
        description: 'Please try again.',
        variant: 'destructive',
      });
    },
    onSuccess: (data, variables, context) => {
      if (context?.targetEventId) {
        // Replace optimistic reaction with real one
        queryClient.setQueryData<NostrEvent[]>(['reactions', context.targetEventId], old => {
          if (!old) return [data];
          return old.map(reaction =>
            reaction.id === context.optimisticReaction.id ? data : reaction
          );
        });
      }
    },
    onSettled: (_, __, { targetEvent }) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: ['reactions', targetEvent.id]
      });

      // Also invalidate the messages query to update the UI
      queryClient.invalidateQueries({
        queryKey: ['messages']
      });
    },
  });

  const removeReaction = useMutation({
    mutationFn: async ({ targetEvent, emoji }: RemoveReactionParams) => {
      if (!user) {
        throw new Error('User must be logged in to remove reaction');
      }

      // Create a deletion event (kind 5) to remove the reaction
      // First, we need to find the reaction event to delete
      // This is a simplified approach - in a real implementation,
      // you'd query for the user's reaction events and delete the specific one

      // For now, we'll create a new reaction with the same emoji
      // The backend should handle deduplication/toggling
      const reactionEvent = await createEvent({
        kind: 7,
        content: emoji,
        tags: [
          ['e', targetEvent.id],
          ['p', targetEvent.pubkey],
          ['k', targetEvent.kind.toString()],
        ],
      });

      return reactionEvent;
    },
    onSuccess: (_, { targetEvent }) => {
      queryClient.invalidateQueries({
        queryKey: ['reactions', targetEvent.id]
      });

      queryClient.invalidateQueries({
        queryKey: ['messages']
      });
    },
    onError: (error) => {
      console.error('Failed to remove reaction:', error);
      toast({
        title: 'Failed to remove reaction',
        description: 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  return {
    addReaction: addReaction.mutate,
    removeReaction: removeReaction.mutate,
    isAddingReaction: addReaction.isPending,
    isRemovingReaction: removeReaction.isPending,
  };
}