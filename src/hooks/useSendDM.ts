import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';

interface SendDMParams {
  recipientPubkey: string;
  content: string;
}

export function useSendDM() {
  const { mutateAsync: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ recipientPubkey, content }: SendDMParams) => {
      if (!user?.signer) {
        throw new Error('User must be logged in with a signer to send DMs');
      }

      let encryptedContent: string;
      let kind: number;

      try {
        // Try NIP-44 encryption first (if available)
        if (user.signer.nip44) {
          encryptedContent = await user.signer.nip44.encrypt(recipientPubkey, content);
          kind = 1059; // NIP-44 encrypted DM
        }
        // Fall back to NIP-04 encryption
        else if (user.signer.nip04) {
          encryptedContent = await user.signer.nip04.encrypt(recipientPubkey, content);
          kind = 4; // NIP-04 encrypted DM
        }
        else {
          throw new Error('No encryption method available');
        }
      } catch (error) {
        console.error('Failed to encrypt DM:', error);
        throw new Error('Failed to encrypt message');
      }

      const tags = [
        ["p", recipientPubkey],
      ];

      await createEvent({
        kind,
        content: encryptedContent,
        tags,
      });

      // Invalidate relevant queries to refetch
      queryClient.invalidateQueries({
        queryKey: ['direct-messages', user.pubkey]
      });
      queryClient.invalidateQueries({
        queryKey: ['dm-messages', user.pubkey, recipientPubkey]
      });
    },
    onError: (error) => {
      console.error('Failed to send DM:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });
}