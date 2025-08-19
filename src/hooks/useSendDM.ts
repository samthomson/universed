import { useMutation } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger';

interface BaseSendDMParams {
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

  // Helper function to prepare content with attachments
  const prepareMessageContent = (content: string, attachments: BaseSendDMParams['attachments'] = []) => {
    if (attachments.length === 0) return content;
    
    const fileUrls = attachments.map(file => file.url).join('\n');
    return content ? `${content}\n\n${fileUrls}` : fileUrls;
  };

  // Helper function to create imeta tags for attachments
  const createImetaTags = (attachments: BaseSendDMParams['attachments'] = []) => {
    return attachments.map(file => {
      const imetaTag = ["imeta"];
      imetaTag.push(`url ${file.url}`);
      if (file.mimeType) imetaTag.push(`m ${file.mimeType}`);
      if (file.size) imetaTag.push(`size ${file.size}`);
      if (file.name) imetaTag.push(`alt ${file.name}`);

      file.tags.forEach(tag => {
        if (tag[0] === 'x') imetaTag.push(`x ${tag[1]}`);
        if (tag[0] === 'ox') imetaTag.push(`ox ${tag[1]}`);
      });

      return imetaTag;
    });
  };

  const sendNIP4Message = useMutation({
    mutationFn: async ({ recipientPubkey, content, attachments = [] }: BaseSendDMParams) => {
      if (!user?.signer?.nip04) {
        logger.error('[SendDM] NIP-04 encryption not available');
        throw new Error('NIP-04 encryption not available');
      }

      logger.log('[SendDM] Sending NIP-04 message');
      
      const messageContent = prepareMessageContent(content, attachments);
      const encryptedContent = await user.signer.nip04.encrypt(recipientPubkey, messageContent);
      
      const tags = [
        ["p", recipientPubkey],
        ...createImetaTags(attachments)
      ];

      const event = await createEvent({
        kind: 4, // NIP-04 encrypted DM
        content: encryptedContent,
        tags,
      });

      logger.log('[SendDM] Created NIP-04 message:', event);
      return event;
    },
    onError: (error) => {
      logger.error('Failed to send NIP-04 DM:', error);
      toast({
        title: "Error",
        description: "Failed to send NIP-04 message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const sendNIP17Message = useMutation({
    mutationFn: async ({ recipientPubkey, content, attachments = [] }: BaseSendDMParams) => {
      if (!user?.signer?.nip44) {
        logger.error('[SendDM] NIP-44 encryption not available for NIP-17');
        throw new Error('NIP-44 encryption not available for NIP-17');
      }

      logger.log('[SendDM] Sending NIP-17 Gift Wrap message');
      
      const messageContent = prepareMessageContent(content, attachments);

      // Step 1: Create and sign the Kind 14 Private DM event
      const privateDMTags = [
        ["p", recipientPubkey],
        ...createImetaTags(attachments)
      ];

      const privateDM = await user.signer.signEvent({
        kind: 14,
        content: messageContent,
        tags: privateDMTags,
        created_at: Math.floor(Date.now() / 1000),
      });



      // Step 2: Create TWO Kind 13 Seal events - one for recipient, one for sender
      
      // Seal for recipient (encrypted to them)
      const recipientSeal = await user.signer.signEvent({
        kind: 13,
        content: await user.signer.nip44.encrypt(recipientPubkey, JSON.stringify(privateDM)),
        tags: [], // Seal events typically have no tags
        created_at: Math.floor(Date.now() / 1000),
      });

      // Seal for sender (encrypted to us)
      const senderSeal = await user.signer.signEvent({
        kind: 13,
        content: await user.signer.nip44.encrypt(user.pubkey, JSON.stringify(privateDM)),
        tags: [], // Seal events typically have no tags
        created_at: Math.floor(Date.now() / 1000),
      });



      // Step 3: Create TWO Kind 1059 Gift Wrap events
      // One for the recipient, one for myself (so I can see sent messages)

      // Gift Wrap for recipient - they should be able to find it via their pubkey in p tag
      const recipientGiftWrap = await createEvent({
        kind: 1059, // Gift Wrap
        content: await user.signer.nip44.encrypt(recipientPubkey, JSON.stringify(recipientSeal)),
        tags: [["p", recipientPubkey]], // Recipient can find this via their pubkey
      });

      // Gift Wrap for myself - I should be able to find it via my pubkey in p tag
      const myGiftWrap = await createEvent({
        kind: 1059, // Gift Wrap
        content: await user.signer.nip44.encrypt(user.pubkey, JSON.stringify(senderSeal)),
        tags: [["p", user.pubkey]], // I can find this via my pubkey
      });


      
      return { recipientGiftWrap, myGiftWrap };
    },
    onError: (error) => {
      logger.error('Failed to send NIP-17 DM:', error);
      toast({
        title: "Error",
        description: "Failed to send NIP-17 message. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    sendNIP4Message,
    sendNIP17Message,
  };
}