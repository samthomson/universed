import { useLocalStorage } from './useLocalStorage';
import { useConversationList } from './useConversationList';
import { useNIP4DirectMessages } from './useNIP4DirectMessages';
import { useNIP17DirectMessages } from './useNIP17DirectMessages';
import { useSendDM } from './useSendDM';
import { useMemo } from 'react';

/**
 * Main orchestrator hook for direct messages.
 * Combines NIP-4 and NIP-17 messages and manages global DM settings.
 */
export function useDirectMessages() {
  const [isNIP17Enabled, setNIP17Enabled] = useLocalStorage('enableNIP17', false);
  const conversationList = useConversationList();
  const { mutateAsync: sendDM } = useSendDM();

  const getChatMessages = (conversationId: string) => {
    const nip4Messages = useNIP4DirectMessages(conversationId);
    const nip17Messages = useNIP17DirectMessages(conversationId, isNIP17Enabled);

    // Merge messages from both protocols
    const allMessages = useMemo(() => {
      const nip4Messages_ = Array.isArray(nip4Messages.messages) ? nip4Messages.messages : [];
      const nip17Messages_ = Array.isArray(nip17Messages.messages) ? nip17Messages.messages : [];
      
      const nip4WithProtocol = nip4Messages_.map((msg: any) => {
        if (!msg || typeof msg !== 'object') return null;
        return { 
          ...msg, 
          protocol: 'nip04' as const 
        };
      }).filter(Boolean);
      
      const nip17WithProtocol = nip17Messages_.map((msg: any) => {
        if (!msg || typeof msg !== 'object') return null;
        return { 
          ...msg, 
          protocol: 'nip17' as const 
        };
      }).filter(Boolean);
      
      const combined = [...nip4WithProtocol, ...nip17WithProtocol];
      return combined.sort((a, b) => a.created_at - b.created_at);
    }, [nip4Messages.messages, nip17Messages.messages]);

    return {
      messages: allMessages,
      isLoading: nip4Messages.isLoading || (isNIP17Enabled && nip17Messages.isLoading),
      hasMoreMessages: nip4Messages.hasMoreMessages || (isNIP17Enabled && nip17Messages.hasMoreMessages),
      loadingOlderMessages: nip4Messages.loadingOlderMessages || (isNIP17Enabled && nip17Messages.loadingOlderMessages),
      loadOlderMessages: async () => {
        // Load older messages from both protocols
        await Promise.all([
          nip4Messages.loadOlderMessages(),
          isNIP17Enabled ? nip17Messages.loadOlderMessages() : Promise.resolve()
        ]);
      },
    };
  };

  const getConversationList = () => ({
    conversations: conversationList.conversations.map(conv => ({
      id: conv.pubkey,
      name: undefined, // Will be populated by UI with author metadata
      picture: undefined,
      lastMessage: conv.lastMessage,
      lastActivity: conv.lastActivity,
      unreadCount: 0, // Removed unread tracking per user feedback
      hasNIP4Messages: conv.hasNIP4Messages,
      hasNIP17Messages: conv.hasNIP17Messages,
    })),
    isLoading: conversationList.isLoading,
    processedCount: conversationList.processedCount,
    totalToProcess: conversationList.totalToProcess,
  });

  const sendMessage = async (_recipientPubkey: string, _content: string) => {
    // Use existing useSendDM hook which already handles NIP-4/NIP-17 selection
    return await sendDM({
      recipientPubkey: _recipientPubkey,
      content: _content,
    });
  };

  return {
    isNIP17Enabled,
    setNIP17Enabled,
    getChatMessages,
    getConversationList,
    sendMessage,
  };
}