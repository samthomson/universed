import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';
import { useUserCommunitiesCache } from './useUserCommunitiesCache';

export interface JoinCommunityParams {
  communityId: string;
  message?: string;
}

/**
 * Hook for requesting to join a community.
 * Creates a Kind 4552 join request event and optimistically updates the cache.
 */
export function useJoinCommunity() {
  const { mutate: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { invalidateUserCommunitiesCache } = useUserCommunitiesCache();

  return useMutation({
    mutationFn: async ({ communityId, message = '' }: JoinCommunityParams) => {
      if (!user) {
        throw new Error('User must be logged in to join a community');
      }

      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: 4552,
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

      // Invalidate user communities cache to trigger background refresh
      invalidateUserCommunitiesCache();
    },
  });
}