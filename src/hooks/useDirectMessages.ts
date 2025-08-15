import { useLocalStorage } from './useLocalStorage';
import { useConversationList } from './useConversationList';
import { useNIP4DirectMessages } from './useNIP4DirectMessages';
import { useNIP17DirectMessages } from './useNIP17DirectMessages';
import { useSendDM } from './useSendDM';
import { useMemo, useEffect, useState, useCallback } from 'react';
import { logger } from '@/lib/logger';
import type { NostrEvent } from '@nostrify/nostrify';

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
    case 1059: return MESSAGE_PROTOCOL.NIP17; // Gift Wrap
    case 14: return MESSAGE_PROTOCOL.NIP17;   // Private DM (decrypted NIP-17)
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
 * Combines NIP-4 and NIP-17 messages for a specific conversation with timestamp-based pagination
 */
export function useDirectMessagesForChat(conversationId: string, until?: number) {
  const [isNIP17Enabled] = useLocalStorage('enableNIP17', true);
  
  // Get messages from both NIP-4 and NIP-17 hooks with timestamp filter
  const nip4Messages = useNIP4DirectMessages(conversationId, false, until); // Specific conversation mode
  const nip17Messages = useNIP17DirectMessages(conversationId, isNIP17Enabled, false, until); // Specific conversation mode
  
  logger.log(`[DMCHAT] useDirectMessagesForChat called with conversationId: "${conversationId}", until: ${until}`);
  logger.log(`[DMCHAT] isNIP17Enabled: ${isNIP17Enabled}`);
  logger.log(`[DMCHAT] NIP-4 messages loading: ${nip4Messages.isLoading}, count: ${nip4Messages.messages?.length || 0}`);
  logger.log(`[DMCHAT] NIP-17 messages loading: ${nip17Messages.isLoading}, count: ${nip17Messages.messages?.length || 0}`);
  
  // Combine, sort, and limit messages from both sources
  const combinedResult = useMemo(() => {
    const MESSAGES_PER_PAGE = 100;
    
    const nip4Count = nip4Messages.messages?.length || 0;
    const nip17Count = nip17Messages.messages?.length || 0;
    
    logger.log(`[DMCHAT] Combining messages: NIP-4 (${nip4Count}), NIP-17 (${nip17Count})`);
    
    // Combine all messages
    const combined = [
      ...(nip4Messages.messages || []),
      ...(nip17Messages.messages || [])
    ];
    
    logger.log(`[DMCHAT] Total combined messages: ${combined.length}`);
    
    // Sort by timestamp (newest first)
    const sorted = combined.sort((a, b) => b.created_at - a.created_at);
    
    // Take most recent MESSAGES_PER_PAGE messages
    const paginated = sorted.slice(0, MESSAGES_PER_PAGE);
    
    // Check if either hook has more messages available
    const hasMore = nip4Messages.hasMoreMessages || nip17Messages.hasMoreMessages || sorted.length > MESSAGES_PER_PAGE;
    
    // Return in chronological order (oldest first) for chat display
    const chronological = paginated.reverse();
    
    logger.log(`[DMCHAT] Final result: ${chronological.length} messages, hasMore: ${hasMore}`);
    if (chronological.length > 0) {
      logger.log(`[DMCHAT] First (oldest) message:`, chronological[0]);
      logger.log(`[DMCHAT] Last (newest) message:`, chronological[chronological.length - 1]);
    }
    
    return {
      messages: chronological,
      hasMore,
      oldestDisplayed: chronological.length > 0 ? chronological[0].created_at : undefined,
    };
  }, [nip4Messages.messages, nip17Messages.messages, nip4Messages.hasMoreMessages, nip17Messages.hasMoreMessages]);

  return {
    data: combinedResult.messages,
    isLoading: nip4Messages.isLoading || nip17Messages.isLoading,
    hasMoreMessages: combinedResult.hasMore,
    loadingOlderMessages: nip4Messages.loadingOlderMessages || nip17Messages.loadingOlderMessages,
    loadOlderMessages: async () => {
      // This will be called by the UI when user wants to load older messages
      // The timestamp will be passed as 'until' parameter in the next call to this hook
      logger.log(`[DMCHAT] loadOlderMessages called - next call should use until: ${combinedResult.oldestDisplayed}`);
    },
    reachedStartOfConversation: !combinedResult.hasMore,
    // Expose the timestamp for the UI to use in pagination
    oldestMessageTimestamp: combinedResult.oldestDisplayed,
  };
}

/**
 * Stateful wrapper hook for chat pagination
 * Manages the 'until' timestamp internally and provides loadOlderMessages function
 */
export function useDirectMessagesForChatWithPagination(conversationId: string) {
  const [until, setUntil] = useState<number | undefined>(undefined);
  const [allMessages, setAllMessages] = useState<NostrEvent[]>([]);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  // Get current page of messages
  const currentPage = useDirectMessagesForChat(conversationId, until);

  // When new messages arrive, append them to our accumulator
  useEffect(() => {
    if (!currentPage.isLoading && currentPage.data.length > 0) {
      setAllMessages(prev => {
        // If this is the first load (until is undefined), replace all messages
        if (until === undefined) {
          return currentPage.data;
        }
        // Otherwise, prepend older messages (they should be in chronological order)
        const newOlderMessages = currentPage.data.filter(msg => 
          !prev.some(existing => existing.id === msg.id)
        );
        return [...newOlderMessages, ...prev];
      });
      setIsLoadingOlder(false);
    }
  }, [currentPage.data, currentPage.isLoading, until]);

  const loadOlderMessages = useCallback(async () => {
    if (currentPage.hasMoreMessages && !isLoadingOlder) {
      setIsLoadingOlder(true);
      const oldestTimestamp = currentPage.oldestMessageTimestamp;
      if (oldestTimestamp) {
        logger.log(`[DMCHAT] Loading older messages before timestamp: ${oldestTimestamp}`);
        setUntil(oldestTimestamp);
      }
    }
  }, [currentPage.hasMoreMessages, currentPage.oldestMessageTimestamp, isLoadingOlder]);

  return {
    data: allMessages,
    isLoading: currentPage.isLoading && until === undefined, // Only show loading on initial load
    hasMoreMessages: currentPage.hasMoreMessages,
    loadingOlderMessages: isLoadingOlder,
    loadOlderMessages,
    reachedStartOfConversation: !currentPage.hasMoreMessages,
  };
}