import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import type { NostrEvent } from '@nostrify/nostrify';

interface AddReactionParams {
  targetEvent: NostrEvent;
  emoji: string;
}

export function useAddReaction() {
  const { mutateAsync: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ targetEvent, emoji }: AddReactionParams) => {
      if (!user) {
        throw new Error('User must be logged in to react');
      }

      // Check if user already reacted with this emoji
      const existingReactions = queryClient.getQueryData<NostrEvent[]>(['reactions', targetEvent.id]) || [];
      const hasReacted = existingReactions.some(
        r => r.pubkey === user.pubkey && r.content === emoji
      );

      if (hasReacted) {
        // Remove reaction by creating a deletion event
        // For now, we'll just skip duplicate reactions
        return;
      }

      const tags = [
        ["e", targetEvent.id, "", targetEvent.pubkey],
        ["p", targetEvent.pubkey],
        ["k", targetEvent.kind.toString()],
      ];

      await createEvent({
        kind: 7,
        content: emoji,
        tags,
      });

      // Invalidate reactions query to refetch
      queryClient.invalidateQueries({ 
        queryKey: ['reactions', targetEvent.id] 
      });
    },
    onError: (error) => {
      console.error('Failed to add reaction:', error);
      toast({
        title: "Error",
        description: "Failed to add reaction. Please try again.",
        variant: "destructive",
      });
    },
  });
}