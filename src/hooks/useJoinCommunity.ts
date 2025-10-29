import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';
import { useDataManager } from '@/components/DataManagerProvider';

export interface JoinCommunityParams {
  communityId: string;
  message?: string;
}

/**
 * Hook for requesting to join a community.
 * Creates a Kind 4552 join request event and adds the community to the local state.
 */
export function useJoinCommunity() {
  const { mutate: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { communities } = useDataManager();

  return useMutation({
    mutationFn: async ({ communityId, message = '' }: JoinCommunityParams) => {
      if (!user) {
        throw new Error('User must be logged in to join a community');
      }

      // Publish join request event
      await new Promise<void>((resolve, reject) => {
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

      // Add community to local state as prospective
      await communities.addProspectiveCommunity(communityId);

      return { communityId };
    },
    onSuccess: () => {
      // Invalidate membership queries to refetch updated status
      queryClient.invalidateQueries({ queryKey: ['user-membership'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });
}