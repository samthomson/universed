import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';

export interface AddMemberParams {
  communityId: string;
  memberPubkey: string;
}

export interface RemoveMemberParams {
  communityId: string;
  memberPubkey: string;
}

/**
 * Hook for managing community members (adding/removing from approved list).
 * Only works for community moderators and owners.
 */
export function useManageMembers() {
  const { nostr } = useNostr();
  const { mutate: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const addMember = useMutation({
    mutationFn: async ({ communityId, memberPubkey }: AddMemberParams) => {
      if (!user) {
        throw new Error('User must be logged in to manage members');
      }

      const signal = AbortSignal.timeout(5000);

      // Get current approved members list
      const membershipEvents = await nostr.query([
        {
          kinds: [34551], // Approved members list
          '#d': [communityId],
          authors: [user.pubkey], // Only events created by current user
          limit: 10,
        }
      ], { signal });

      // Get the most recent membership list
      const latestEvent = membershipEvents
        .sort((a, b) => b.created_at - a.created_at)[0];

      // Get current approved members
      const currentMembers = new Set<string>();
      if (latestEvent) {
        latestEvent.tags
          .filter(([name]) => name === 'p')
          .forEach(([, pubkey]) => {
            if (pubkey) currentMembers.add(pubkey);
          });
      }

      // Add the new member
      currentMembers.add(memberPubkey);

      // Create new approved members list
      const tags = [
        ['d', communityId],
        ...Array.from(currentMembers).map(pubkey => ['p', pubkey])
      ];

      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: 34551,
            content: '',
            tags,
          },
          {
            onSuccess: () => resolve(),
            onError: (error) => reject(error),
          }
        );
      });
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['community-members'] });
      queryClient.invalidateQueries({ queryKey: ['user-membership'] });
    },
  });

  const removeMember = useMutation({
    mutationFn: async ({ communityId, memberPubkey }: RemoveMemberParams) => {
      if (!user) {
        throw new Error('User must be logged in to manage members');
      }

      const signal = AbortSignal.timeout(5000);

      // Get current approved members list
      const membershipEvents = await nostr.query([
        {
          kinds: [34551], // Approved members list
          '#d': [communityId],
          authors: [user.pubkey], // Only events created by current user
          limit: 10,
        }
      ], { signal });

      // Get the most recent membership list
      const latestEvent = membershipEvents
        .sort((a, b) => b.created_at - a.created_at)[0];

      // Get current approved members
      const currentMembers = new Set<string>();
      if (latestEvent) {
        latestEvent.tags
          .filter(([name]) => name === 'p')
          .forEach(([, pubkey]) => {
            if (pubkey) currentMembers.add(pubkey);
          });
      }

      // Remove the member
      currentMembers.delete(memberPubkey);

      // Create new approved members list
      const tags = [
        ['d', communityId],
        ...Array.from(currentMembers).map(pubkey => ['p', pubkey])
      ];

      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: 34551,
            content: '',
            tags,
          },
          {
            onSuccess: () => resolve(),
            onError: (error) => reject(error),
          }
        );
      });
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['community-members'] });
      queryClient.invalidateQueries({ queryKey: ['user-membership'] });
    },
  });

  return {
    addMember: addMember.mutate,
    removeMember: removeMember.mutate,
    isAddingMember: addMember.isPending,
    isRemovingMember: removeMember.isPending,
  };
}