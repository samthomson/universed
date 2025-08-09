import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import { useMutedUsers } from './useMutedUsers';
import { useToast } from './useToast';

// NIP-51 Mute list kind
const MUTE_LIST_KIND = 10000;

/**
 * Hook to manage muted users list according to NIP-51
 * Uses kind 10000 for mute lists (standard replaceable event)
 */
export function useManageMutedUsers() {
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { data: currentMutedUsers = [] } = useMutedUsers();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const muteUser = useMutation({
    mutationFn: async (pubkey: string) => {
      if (!user?.pubkey) {
        throw new Error('Must be logged in to mute users');
      }

      if (pubkey === user.pubkey) {
        throw new Error('Cannot mute yourself');
      }

      // Check if already muted
      if (currentMutedUsers.includes(pubkey)) {
        throw new Error('User is already muted');
      }

      // Create updated muted list
      const updatedMutedUsers = [...currentMutedUsers, pubkey];

      // Convert to p tags according to NIP-51
      const pTags = updatedMutedUsers.map(mutedPubkey => ['p', mutedPubkey]);

      // Publish updated mute list (kind 10000, no 'd' tag needed for standard replaceable events)
      await publishEvent({
        kind: MUTE_LIST_KIND,
        content: '',
        tags: pTags,
      });

      return pubkey;
    },
    onSuccess: () => {
      // Invalidate muted users query to refetch
      queryClient.invalidateQueries({ queryKey: ['muted-users', user?.pubkey] });
      
      toast({
        title: 'User muted',
        description: 'User has been added to your mute list',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to mute user',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const unmuteUser = useMutation({
    mutationFn: async (pubkey: string) => {
      if (!user?.pubkey) {
        throw new Error('Must be logged in to unmute users');
      }

      // Filter out the user to unmute
      const updatedMutedUsers = currentMutedUsers.filter(mutedPubkey => mutedPubkey !== pubkey);

      // Convert to p tags according to NIP-51
      const pTags = updatedMutedUsers.map(mutedPubkey => ['p', mutedPubkey]);

      // Publish updated mute list (kind 10000, no 'd' tag needed)
      await publishEvent({
        kind: MUTE_LIST_KIND,
        content: '',
        tags: pTags,
      });

      return pubkey;
    },
    onSuccess: () => {
      // Invalidate muted users query to refetch
      queryClient.invalidateQueries({ queryKey: ['muted-users', user?.pubkey] });
      
      toast({
        title: 'User unmuted',
        description: 'User has been removed from your mute list',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to unmute user',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    muteUser: muteUser.mutateAsync,
    unmuteUser: unmuteUser.mutateAsync,
    isMuting: muteUser.isPending,
    isUnmuting: unmuteUser.isPending,
  };
}