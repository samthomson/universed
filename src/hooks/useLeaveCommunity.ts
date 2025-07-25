import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';

export interface LeaveCommunityParams {
  communityId: string;
  message?: string;
}

/**
 * Hook for requesting to leave a community.
 * Creates a Kind 4553 leave request event.
 */
export function useLeaveCommunity() {
  const { mutate: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ communityId, message = '' }: LeaveCommunityParams) => {
      if (!user) {
        throw new Error('User must be logged in to leave a community');
      }

      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: 4553,
            content: message,
            tags: [['a', communityId]],
          },
          {
            onSuccess: () => resolve(),
            onError: (error) => reject(error),
          }
        );
      });
    },
    onSuccess: () => {
      // Invalidate membership queries to refetch updated status
      queryClient.invalidateQueries({ queryKey: ['user-membership'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });
}