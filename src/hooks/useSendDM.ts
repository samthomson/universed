import { useMutation } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger';

interface SendDMParams {
  recipientPubkey: string;
  content: string;
  attachments?: Array<{
    url: string;
    mimeType: string;
    size: number;
    name: string;
    tags: string[][];
  }>;
}

export function useSendDM() {
  const { mutateAsync: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ recipientPubkey, content, attachments = [] }: SendDMParams) => {
      if (!user?.signer) {
        throw new Error('User must be logged in with a signer to send DMs');
      }

      // Prepare content with file URLs if there are attachments
      let messageContent = content;
      if (attachments.length > 0) {
        const fileUrls = attachments.map(file => file.url).join('\n');
        messageContent = content ? `${content}\n\n${fileUrls}` : fileUrls;
      }

      let encryptedContent: string;
      let kind: number;

      try {
        // Try NIP-44 encryption first (if available)
        if (user.signer.nip44) {
          encryptedContent = await user.signer.nip44.encrypt(recipientPubkey, messageContent);
          kind = 1059; // NIP-44 encrypted DM
        }
        // Fall back to NIP-04 encryption
        else if (user.signer.nip04) {
          encryptedContent = await user.signer.nip04.encrypt(recipientPubkey, messageContent);
          kind = 4; // NIP-04 encrypted DM
        }
        else {
          throw new Error('No encryption method available');
        }
      } catch (error) {
        logger.error('Failed to encrypt DM:', error);
        throw new Error('Failed to encrypt message');
      }

      const tags = [
        ["p", recipientPubkey],
      ];

      // Add imeta tags for attached files
      attachments.forEach(file => {
        const imetaTag = ["imeta"];
        imetaTag.push(`url ${file.url}`);
        if (file.mimeType) imetaTag.push(`m ${file.mimeType}`);
        if (file.size) imetaTag.push(`size ${file.size}`);
        if (file.name) imetaTag.push(`alt ${file.name}`);

        // Add any additional tags from the upload response
        file.tags.forEach(tag => {
          if (tag[0] === 'x') imetaTag.push(`x ${tag[1]}`); // hash
          if (tag[0] === 'ox') imetaTag.push(`ox ${tag[1]}`); // original hash
        });

        tags.push(imetaTag);
      });

      const event = await createEvent({
        kind,
        content: encryptedContent,
        tags,
      });

      return event;
    },
    onError: (error) => {
      logger.error('Failed to send DM:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },

  });
}