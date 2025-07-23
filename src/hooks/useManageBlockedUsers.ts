import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import { useBlockedUsers } from './useBlockedUsers';
import { useToast } from './useToast';

const USER_LIST_KIND = 30000;

/**
 * Hook to manage blocked users list
 */
export function useManageBlockedUsers() {
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { data: currentBlockedUsers = [] } = useBlockedUsers();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const blockUser = useMutation({
    mutationFn: async (pubkey: string) => {
      if (!user?.pubkey) {
        throw new Error('Must be logged in to block users');
      }

      if (pubkey === user.pubkey) {
        throw new Error('Cannot block yourself');
      }

      // Check if already blocked
      if (currentBlockedUsers.includes(pubkey)) {
        throw new Error('User is already blocked');
      }

      // Create updated blocked list
      const updatedBlockedUsers = [...currentBlockedUsers, pubkey];

      // Convert to p tags
      const pTags = updatedBlockedUsers.map(blockedPubkey => ['p', blockedPubkey]);

      // Publish updated blocked list (kind 30000 with d tag "blocked")
      await publishEvent({
        kind: USER_LIST_KIND,
        content: '',
        tags: [
          ['d', 'blocked'],
          ...pTags,
        ],
      });

      return pubkey;
    },
    onSuccess: () => {
      // Invalidate blocked users query to refetch
      queryClient.invalidateQueries({ queryKey: ['blocked-users', user?.pubkey] });
      
      toast({
        title: 'User blocked',
        description: 'User has been added to your blocked list',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to block user',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const unblockUser = useMutation({
    mutationFn: async (pubkey: string) => {
      if (!user?.pubkey) {
        throw new Error('Must be logged in to unblock users');
      }

      // Filter out the user to unblock
      const updatedBlockedUsers = currentBlockedUsers.filter(blockedPubkey => blockedPubkey !== pubkey);

      // Convert to p tags
      const pTags = updatedBlockedUsers.map(blockedPubkey => ['p', blockedPubkey]);

      // Publish updated blocked list
      await publishEvent({
        kind: USER_LIST_KIND,
        content: '',
        tags: [
          ['d', 'blocked'],
          ...pTags,
        ],
      });

      return pubkey;
    },
    onSuccess: () => {
      // Invalidate blocked users query to refetch
      queryClient.invalidateQueries({ queryKey: ['blocked-users', user?.pubkey] });
      
      toast({
        title: 'User unblocked',
        description: 'User has been removed from your blocked list',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to unblock user',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    blockUser: blockUser.mutateAsync,
    unblockUser: unblockUser.mutateAsync,
    isBlocking: blockUser.isPending,
    isUnblocking: unblockUser.isPending,
  };
}