import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';
import type { NostrEvent } from '@nostrify/nostrify';

export function useDMDecrypt(message: NostrEvent | undefined) {
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['dm-decrypt', message?.id],
    queryFn: async () => {
      if (!user?.signer || !message) {
        throw new Error('No signer available or no message');
      }

      // Determine the other party's pubkey
      let otherPubkey: string;
      if (message.pubkey === user.pubkey) {
        // We sent this message, find the recipient
        const pTag = message.tags.find(([name]) => name === 'p');
        otherPubkey = pTag?.[1] || '';
      } else {
        // We received this message
        otherPubkey = message.pubkey;
      }

      if (!otherPubkey) {
        throw new Error('Could not determine conversation partner');
      }

      try {
        // Try NIP-44 decryption first (if available)
        if (user.signer.nip44 && message.kind === 1059) {
          return await user.signer.nip44.decrypt(otherPubkey, message.content);
        }

        // Fall back to NIP-04 decryption
        if (user.signer.nip04 && message.kind === 4) {
          return await user.signer.nip04.decrypt(otherPubkey, message.content);
        }

        throw new Error('No decryption method available');
      } catch (error) {
        console.error('Failed to decrypt DM:', error);
        throw error;
      }
    },
    enabled: !!user?.signer && !!message,
    staleTime: Infinity, // Decrypted content doesn't change
    retry: false, // Don't retry failed decryptions
  });
}