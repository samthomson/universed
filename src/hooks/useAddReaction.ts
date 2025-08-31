import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import type { NostrEvent } from '@nostrify/nostrify';
import type { ReactionsAndZapsResult } from '@/types/reactions';
import { logger } from '@/lib/logger';

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
      const existingData = queryClient.getQueryData<ReactionsAndZapsResult>(['reactions-and-zaps', targetEvent.id]);
      const hasReacted = existingData?.reactionGroups?.[emoji]?.some(
        (r: NostrEvent) => r.pubkey === user.pubkey
      ) || false;

      if (hasReacted) {
        // User already reacted with this emoji, skip to prevent duplicates
        logger.log('User already reacted with this emoji, skipping duplicate');
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

      // Invalidate reactions queries to refetch
      queryClient.invalidateQueries({ queryKey: ['reactions', targetEvent.id] });
      queryClient.invalidateQueries({ queryKey: ['reactions-and-zaps', targetEvent.id] });
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