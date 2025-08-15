import { useLocalStorage } from './useLocalStorage';
import { useConversationList } from './useConversationList';
import { useNIP4DirectMessages } from './useNIP4DirectMessages';
import { useNIP17DirectMessages } from './useNIP17DirectMessages';
import { useSendDM } from './useSendDM';
import { useMemo } from 'react';
import { logger } from '@/lib/logger';

// Configuration for messaging and conversation discovery
const MESSAGING_CONFIG = {
  // Friend-based discovery settings
  isWatchingMutualFollows: true,
  isWatchingUsersFollows: true,
  // Comprehensive scanning settings
  isWatchingAll: true,
  // Note: isNIP17Enabled removed - now controlled by user toggle only
};

/**
 * Main orchestrator hook for direct messages.
 * Combines NIP-4 and NIP-17 messages and manages global DM settings.
 */
export function useDirectMessages() {
  const [isNIP17Enabled, setNIP17Enabled] = useLocalStorage('enableNIP17', true);
  const conversationList = useConversationList();
  const { mutateAsync: sendDM } = useSendDM();
  
  // Get comprehensive NIP-4 conversation discovery if isWatchingAll is enabled
  const nip4AllConversations = useNIP4DirectMessages('', MESSAGING_CONFIG.isWatchingAll);
  // Get comprehensive NIP-17 conversation discovery if user has enabled it
  const nip17AllConversations = useNIP17DirectMessages('', isNIP17Enabled, true);
  
  // Debug logging for NIP-17 status
  logger.log(`[DirectMessages] NIP-17 scan enabled: ${isNIP17Enabled}`);

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
    const nip17ComprehensiveConvos = (isNIP17Enabled && Array.isArray(nip17AllConversations.conversations))
      ? nip17AllConversations.conversations 
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
    
    // Add comprehensive NIP-17 conversations (merge with existing ones)
    nip17ComprehensiveConvos.forEach(conv => {
      const existing = conversationMap.get(conv.pubkey);
      if (!existing) {
        // New conversation from NIP-17 only
        conversationMap.set(conv.pubkey, {
          id: conv.pubkey,
          name: undefined,
          picture: undefined,
          lastMessage: conv.lastMessage,
          lastActivity: conv.lastActivity,
          unreadCount: 0,
          hasNIP4Messages: conv.hasNIP4Messages,
          hasNIP17Messages: conv.hasNIP17Messages,
          recentMessages: conv.recentMessages || [],
        });
      } else {
        // Merge NIP-17 data with existing conversation
        existing.hasNIP17Messages = existing.hasNIP17Messages || conv.hasNIP17Messages;
        // Update if NIP-17 message is more recent
        if (conv.lastActivity > existing.lastActivity) {
          existing.lastMessage = conv.lastMessage;
          existing.lastActivity = conv.lastActivity;
        }
        // Merge recent messages (NIP-17 messages are valuable since they include full message content)
        if (conv.recentMessages && conv.recentMessages.length > 0) {
          existing.recentMessages = [...existing.recentMessages, ...conv.recentMessages]
            .sort((a, b) => b.created_at - a.created_at)
            .slice(0, 20); // Keep top 20 most recent messages
        }
      }
    });
    
    return Array.from(conversationMap.values())
      .sort((a, b) => b.lastActivity - a.lastActivity);
  }, [conversationList.conversations, nip4AllConversations.conversations, nip17AllConversations.conversations, isNIP17Enabled]);

  const getConversationList = () => ({
    conversations: allConversations,
    isLoading: conversationList.isLoading || nip4AllConversations.isLoading || (isNIP17Enabled && nip17AllConversations.isLoading),
    // Friend-based discovery progress
    friendsProcessedCount: conversationList.processedCount,
    friendsTotalToProcess: conversationList.totalToProcess,
    // Comprehensive scanning status
    isLoadingComprehensive: nip4AllConversations.isLoading || (isNIP17Enabled && nip17AllConversations.isLoading),
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