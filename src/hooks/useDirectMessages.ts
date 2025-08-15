import { useLocalStorage } from './useLocalStorage';
import { useConversationList } from './useConversationList';
import { useNIP4DirectMessages } from './useNIP4DirectMessages';
import { useNIP17DirectMessages } from './useNIP17DirectMessages';
import { useSendDM } from './useSendDM';
import { useMemo, useEffect } from 'react';
import { logger } from '@/lib/logger';

// Message protocol types
export const MESSAGE_PROTOCOL = {
  NIP04: 'NIP04',
  NIP17: 'NIP17', 
  UNKNOWN: 'UNKNOWN'
} as const;

export type MessageProtocol = typeof MESSAGE_PROTOCOL[keyof typeof MESSAGE_PROTOCOL];

// Helper function to determine message protocol
export function getMessageProtocol(kind: number): MessageProtocol {
  switch (kind) {
    case 4: return MESSAGE_PROTOCOL.NIP04;
    case 1059: return MESSAGE_PROTOCOL.NIP17;
    default: return MESSAGE_PROTOCOL.UNKNOWN;
  }
}

// Protocol indicator configuration
export const PROTOCOL_CONFIG = {
  [MESSAGE_PROTOCOL.NIP04]: {
    color: 'bg-orange-500',
    title: 'NIP-04 encrypted message'
  },
  [MESSAGE_PROTOCOL.NIP17]: {
    color: 'bg-purple-500', 
    title: 'NIP-44/NIP-17 encrypted message'
  },
  [MESSAGE_PROTOCOL.UNKNOWN]: {
    color: 'bg-gray-400',
    title: 'Unknown message type'
  }
} as const;

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
  
  // Extract dependency values to satisfy linter
  const nip4ConversationsLength = Array.isArray(nip4AllConversations.conversations) ? nip4AllConversations.conversations.length : 0;
  
  // Debug logging for NIP-17 status (only log when data changes)
  useEffect(() => {
    logger.log(`[DirectMessages] NIP-17 scan enabled: ${isNIP17Enabled}`);
    logger.log(`[DirectMessages] Friend-based conversations:`, conversationList.conversations?.length || 0);
    logger.log(`[DirectMessages] NIP-4 comprehensive conversations:`, nip4ConversationsLength);
    logger.log(`[DirectMessages] NIP-17 comprehensive conversations:`, nip17AllConversations.conversations?.length || 0);
    
    // Log detailed NIP-17 conversation data
    if (nip17AllConversations.conversations && nip17AllConversations.conversations.length > 0) {
      logger.log(`[DirectMessages] NIP-17 conversations detail:`, nip17AllConversations.conversations.map(conv => ({
        id: conv.id,
        pubkey: conv.pubkey,
        lastActivity: conv.lastActivity,
        hasNIP4Messages: conv.hasNIP4Messages,
        hasNIP17Messages: conv.hasNIP17Messages,
        recentMessages: conv.recentMessages?.length || 0,
        lastMessage: conv.lastMessage ? {
          id: conv.lastMessage.id,
          content: conv.lastMessage.content,
          created_at: conv.lastMessage.created_at,
          kind: conv.lastMessage.kind
        } : null
      })));
    }
  }, [
    isNIP17Enabled,
    conversationList.conversations?.length,
    nip4ConversationsLength,
    nip17AllConversations.conversations?.length,
    nip4AllConversations.conversations,
    nip17AllConversations.conversations
  ]);

  // Note: getChatMessages should not be called here due to hook rules
  // Individual components should use useDirectMessagesForChat hook instead
  const getChatMessages = (_conversationId: string) => {
    // This is a placeholder - components should use useDirectMessagesForChat hook directly
    return {
      data: [],
      isLoading: false,
      hasMoreMessages: false,
      loadingOlderMessages: false,
      loadOlderMessages: async () => {},
      reachedStartOfConversation: false,
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
    
    const finalConversations = Array.from(conversationMap.values())
      .sort((a, b) => b.lastActivity - a.lastActivity);
    
    // Log final conversations only when count changes
    if (finalConversations.length > 0) {
      logger.log(`[DirectMessages] Final merged conversations:`, finalConversations.length);
      logger.log(`[DirectMessages] Merged conversations detail:`, finalConversations.map(conv => ({
        id: conv.id,
        lastActivity: conv.lastActivity,
        hasNIP4Messages: conv.hasNIP4Messages,
        hasNIP17Messages: conv.hasNIP17Messages,
        recentMessages: conv.recentMessages?.length || 0,
        lastMessage: conv.lastMessage ? {
          content: conv.lastMessage.content,
          kind: conv.lastMessage.kind
        } : null
      })));
    }
    
    return finalConversations;
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

/**
 * Separate hook for individual chat message loading
 * Combines NIP-4 and NIP-17 messages for a specific conversation
 */
export function useDirectMessagesForChat(conversationId: string) {
  const [isNIP17Enabled] = useLocalStorage('enableNIP17', true);
  
  // Get messages from both NIP-4 and NIP-17 hooks
  const nip4Messages = useNIP4DirectMessages(conversationId, false); // Specific conversation mode
  const nip17Messages = useNIP17DirectMessages(conversationId, isNIP17Enabled, false); // Specific conversation mode
  
  // Combine and sort messages from both sources
  const allMessages = useMemo(() => {
    const combined = [
      ...(nip4Messages.messages || []),
      ...(nip17Messages.messages || [])
    ];
    
    // Sort by timestamp (oldest first for chronological display)
    return combined.sort((a, b) => a.created_at - b.created_at);
  }, [nip4Messages.messages, nip17Messages.messages]);

  return {
    data: allMessages,
    isLoading: nip4Messages.isLoading || nip17Messages.isLoading,
    hasMoreMessages: nip4Messages.hasMoreMessages || nip17Messages.hasMoreMessages,
    loadingOlderMessages: nip4Messages.loadingOlderMessages || nip17Messages.loadingOlderMessages,
    loadOlderMessages: async () => {
      await Promise.all([
        nip4Messages.loadOlderMessages?.(),
        nip17Messages.loadOlderMessages?.()
      ]);
    },
    reachedStartOfConversation: nip4Messages.reachedStartOfConversation && nip17Messages.reachedStartOfConversation,
  };
}