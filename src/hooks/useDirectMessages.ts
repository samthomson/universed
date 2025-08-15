import { useLocalStorage } from './useLocalStorage';
import { useConversationList } from './useConversationList';
import { useNIP4DirectMessages } from './useNIP4DirectMessages';
import { useNIP17DirectMessages as _useNIP17DirectMessages } from './useNIP17DirectMessages';
import { useSendDM } from './useSendDM';
import { useMemo } from 'react';

// Configuration for messaging and conversation discovery
const MESSAGING_CONFIG = {
  // Friend-based discovery settings
  isWatchingMutualFollows: true,
  isWatchingUsersFollows: true,
  // Comprehensive scanning settings
  isWatchingAll: true,
  isNIP17Enabled: false,
};

/**
 * Main orchestrator hook for direct messages.
 * Combines NIP-4 and NIP-17 messages and manages global DM settings.
 */
export function useDirectMessages() {
  const [isNIP17Enabled, setNIP17Enabled] = useLocalStorage('enableNIP17', false);
  const conversationList = useConversationList();
  const { mutateAsync: sendDM } = useSendDM();
  
  // Get comprehensive NIP-4 conversation discovery if isWatchingAll is enabled
  const nip4AllConversations = useNIP4DirectMessages('__ALL__');
  // TODO: Add NIP-17 comprehensive discovery when isNIP17Enabled is true

  // Note: getChatMessages functionality moved to individual conversation hooks
  // This was causing hook rule violations by calling hooks inside functions
  const getChatMessages = (_conversationId: string) => {
    // This function now just returns a placeholder - actual implementation should use
    // useNIP4DirectMessages and useNIP17DirectMessages directly in components
    return {
      messages: [],
      isLoading: false,
      hasMoreMessages: false,
      loadingOlderMessages: false,
      loadOlderMessages: async () => {},
    };
  };

  // Merge conversations from friend-based discovery and comprehensive scanning
  const allConversations = useMemo(() => {
    const friendBasedConvos = conversationList.conversations || [];
    const nip4ComprehensiveConvos = MESSAGING_CONFIG.isWatchingAll && Array.isArray(nip4AllConversations.conversations) 
      ? nip4AllConversations.conversations 
      : [];
    
    // Merge and deduplicate by pubkey
    const conversationMap = new Map();
    
    // Add friend-based conversations first (they have priority)
    friendBasedConvos.forEach(conv => {
      conversationMap.set(conv.pubkey, {
        id: conv.pubkey,
        name: undefined,
        picture: undefined,
        lastMessage: conv.lastMessage,
        lastActivity: conv.lastActivity,
        unreadCount: 0,
        hasNIP4Messages: conv.hasNIP4Messages,
        hasNIP17Messages: conv.hasNIP17Messages,
        recentMessages: [], // Friend-based discovery doesn't include message content
      });
    });
    
    // Add comprehensive NIP-4 conversations (don't override existing ones)
    nip4ComprehensiveConvos.forEach(conv => {
      if (!conversationMap.has(conv.pubkey)) {
        conversationMap.set(conv.pubkey, {
          id: conv.pubkey,
          name: undefined,
          picture: undefined,
          lastMessage: conv.lastMessage,
          lastActivity: conv.lastActivity,
          unreadCount: 0,
          hasNIP4Messages: conv.hasNIP4Messages,
          hasNIP17Messages: conv.hasNIP17Messages,
          recentMessages: conv.recentMessages || [], // Include recent messages for instant loading
        });
      }
    });
    
    return Array.from(conversationMap.values())
      .sort((a, b) => b.lastActivity - a.lastActivity);
  }, [conversationList.conversations, nip4AllConversations.conversations]);

  const getConversationList = () => ({
    conversations: allConversations,
    isLoading: conversationList.isLoading || (MESSAGING_CONFIG.isWatchingAll && nip4AllConversations.isLoading),
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