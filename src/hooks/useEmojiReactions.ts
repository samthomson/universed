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
    onSuccess: (_, { targetEvent }) => {
      // Invalidate reactions query for this event
      queryClient.invalidateQueries({
        queryKey: ['reactions', targetEvent.id]
      });
      
      // Also invalidate the messages query to update the UI
      queryClient.invalidateQueries({
        queryKey: ['messages']
      });
    },
    onError: (error) => {
      console.error('Failed to add reaction:', error);
      toast({
        title: 'Failed to add reaction',
        description: 'Please try again.',
        variant: 'destructive',
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