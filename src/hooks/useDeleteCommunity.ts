import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useDataManager } from '@/components/DataManagerProvider';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';

export function useDeleteCommunity(communityId: string) {
  const navigate = useNavigate();
  const { communities } = useDataManager();
  const { mutateAsync: createEvent } = useNostrPublish();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const community = communities.communities.get(communityId);
      if (!community) {
        throw new Error('Community not found');
      }

      // Create a kind 5 deletion event
      // For addressable events, use 'a' tag with full coordinate
      await createEvent({
        kind: 5,
        content: 'Community deleted by owner',
        tags: [
          ['a', community.fullAddressableId], // Addressable coordinate (34550:pubkey:identifier)
          ['k', '34550'], // Specify the kind of event being deleted
        ],
      });

      // Immediately remove from local state (soft delete pattern)
      communities.deleteCommunityImmediately(communityId);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Community has been deleted.',
      });

      // Navigate away after deletion
      navigate('/space');
    },
    onError: (error) => {
      console.error('Failed to delete community:', error);
      
      // Check if this is a signer cancellation error
      const isCancelledError = error instanceof Error && 
        (error.message.includes('cancelled') || error.message.includes('rejected'));
      
      toast({
        title: isCancelledError ? 'Deletion Cancelled' : 'Error',
        description: isCancelledError 
          ? 'You cancelled the deletion request. The community was not deleted.'
          : 'Failed to delete community. Please try again.',
        variant: 'destructive',
      });
    },
  });
}

