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

      logger.log('[SendDM] Created Kind 14 Private DM:', privateDM);

      // Step 2: Create and sign the Kind 13 Seal event
      const seal = await user.signer.signEvent({
        kind: 13,
        content: await user.signer.nip44.encrypt(recipientPubkey, JSON.stringify(privateDM)),
        tags: [], // Seal events typically have no tags
        created_at: Math.floor(Date.now() / 1000),
      });

      logger.log('[SendDM] Created Kind 13 Seal:', seal);

      // Step 3: Create TWO Kind 1059 Gift Wrap events
      // One for the recipient, one for myself (so I can see sent messages)
      
      // Generate a random recipient pubkey for metadata hiding
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      const randomRecipient = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');

      // Gift Wrap for recipient
      const recipientGiftWrap = await createEvent({
        kind: 1059, // Gift Wrap
        content: await user.signer.nip44.encrypt(recipientPubkey, JSON.stringify(seal)),
        tags: [["p", randomRecipient]], // Random recipient for metadata hiding
      });

      // Gift Wrap for myself
      const myGiftWrap = await createEvent({
        kind: 1059, // Gift Wrap
        content: await user.signer.nip44.encrypt(user.pubkey, JSON.stringify(seal)),
        tags: [["p", randomRecipient]], // Random recipient for metadata hiding
      });

      logger.log('[SendDM] Created NIP-17 Gift Wrap for recipient:', recipientGiftWrap);
      logger.log('[SendDM] Created NIP-17 Gift Wrap for myself:', myGiftWrap);
      
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