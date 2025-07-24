import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import { useFriends, type Friend } from './useFriends';
import { useToast } from './useToast';

/**
 * Hook to manage friends (add/remove from follow list)
 */
export function useManageFriends() {
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { data: currentFriends = [] } = useFriends();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const addFriend = useMutation({
    mutationFn: async ({ pubkey, relay, petname }: { pubkey: string; relay?: string; petname?: string }) => {
      if (!user?.pubkey) {
        throw new Error('Must be logged in to add friends');
      }

      // Check if already a friend
      const isAlreadyFriend = currentFriends.some(friend => friend.pubkey === pubkey);
      if (isAlreadyFriend) {
        throw new Error('User is already in your friend list');
      }

      // Create new friend entry
      const newFriend: Friend = {
        pubkey,
        relay: relay || '',
        petname: petname || '',
      };

      // Create updated friends list
      const updatedFriends = [...currentFriends, newFriend];

      // Convert to p tags
      const pTags = updatedFriends.map(friend => [
        'p',
        friend.pubkey,
        friend.relay || '',
        friend.petname || '',
      ]);

      // Publish new follow list (kind 3)
      await publishEvent({
        kind: 3,
        content: '',
        tags: pTags,
      });

      return newFriend;
    },
    onMutate: async ({ pubkey, relay, petname }) => {
      if (!user?.pubkey) return;

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['friends', user.pubkey] });

      // Snapshot the previous value
      const previousFriends = queryClient.getQueryData<Friend[]>(['friends', user.pubkey]);

      // Create new friend entry
      const newFriend: Friend = {
        pubkey,
        relay: relay || '',
        petname: petname || '',
      };

      // Optimistically update to the new value
      queryClient.setQueryData<Friend[]>(['friends', user.pubkey], old => {
        return [...(old || []), newFriend];
      });

      // Return a context object with the snapshotted value
      return { previousFriends, newFriend };
    },
    onError: (error, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousFriends && user?.pubkey) {
        queryClient.setQueryData(['friends', user.pubkey], context.previousFriends);
      }

      toast({
        title: 'Failed to add friend',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSuccess: (newFriend) => {
      toast({
        title: 'Friend added',
        description: `Added ${newFriend.petname || 'user'} to your friend list`,
      });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['friends', user?.pubkey] });
    },
  });

  const removeFriend = useMutation({
    mutationFn: async (pubkey: string) => {
      if (!user?.pubkey) {
        throw new Error('Must be logged in to remove friends');
      }

      // Filter out the friend to remove
      const updatedFriends = currentFriends.filter(friend => friend.pubkey !== pubkey);

      // Convert to p tags
      const pTags = updatedFriends.map(friend => [
        'p',
        friend.pubkey,
        friend.relay || '',
        friend.petname || '',
      ]);

      // Publish updated follow list (kind 3)
      await publishEvent({
        kind: 3,
        content: '',
        tags: pTags,
      });

      return pubkey;
    },
    onMutate: async (pubkey) => {
      if (!user?.pubkey) return;

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['friends', user.pubkey] });

      // Snapshot the previous value
      const previousFriends = queryClient.getQueryData<Friend[]>(['friends', user.pubkey]);

      // Optimistically update to the new value
      queryClient.setQueryData<Friend[]>(['friends', user.pubkey], old => {
        return (old || []).filter(friend => friend.pubkey !== pubkey);
      });

      // Return a context object with the snapshotted value
      return { previousFriends };
    },
    onError: (error, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousFriends && user?.pubkey) {
        queryClient.setQueryData(['friends', user.pubkey], context.previousFriends);
      }

      toast({
        title: 'Failed to remove friend',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Friend removed',
        description: 'Removed user from your friend list',
      });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['friends', user?.pubkey] });
    },
  });

  const updateFriendPetname = useMutation({
    mutationFn: async ({ pubkey, petname }: { pubkey: string; petname: string }) => {
      if (!user?.pubkey) {
        throw new Error('Must be logged in to update friend petname');
      }

      // Update the friend's petname
      const updatedFriends = currentFriends.map(friend =>
        friend.pubkey === pubkey
          ? { ...friend, petname }
          : friend
      );

      // Convert to p tags
      const pTags = updatedFriends.map(friend => [
        'p',
        friend.pubkey,
        friend.relay || '',
        friend.petname || '',
      ]);

      // Publish updated follow list (kind 3)
      await publishEvent({
        kind: 3,
        content: '',
        tags: pTags,
      });

      return { pubkey, petname };
    },
    onMutate: async ({ pubkey, petname }) => {
      if (!user?.pubkey) return;

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['friends', user.pubkey] });

      // Snapshot the previous value
      const previousFriends = queryClient.getQueryData<Friend[]>(['friends', user.pubkey]);

      // Optimistically update to the new value
      queryClient.setQueryData<Friend[]>(['friends', user.pubkey], old => {
        return (old || []).map(friend =>
          friend.pubkey === pubkey
            ? { ...friend, petname }
            : friend
        );
      });

      // Return a context object with the snapshotted value
      return { previousFriends };
    },
    onError: (error, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousFriends && user?.pubkey) {
        queryClient.setQueryData(['friends', user.pubkey], context.previousFriends);
      }

      toast({
        title: 'Failed to update petname',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Petname updated',
        description: 'Friend petname has been updated',
      });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['friends', user?.pubkey] });
    },
  });

  return {
    addFriend: addFriend.mutateAsync,
    removeFriend: removeFriend.mutateAsync,
    updateFriendPetname: updateFriendPetname.mutateAsync,
    isAddingFriend: addFriend.isPending,
    isRemovingFriend: removeFriend.isPending,
    isUpdatingPetname: updateFriendPetname.isPending,
  };
}