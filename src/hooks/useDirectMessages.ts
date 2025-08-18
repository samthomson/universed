import { useLocalStorage } from './useLocalStorage';
import { useConversationList } from './useConversationList';
import { useNIP4DirectMessages } from './useNIP4DirectMessages';
import { useNIP17DirectMessages } from './useNIP17DirectMessages';
import { useNIP17ConversationData } from './useNIP17ConversationData';
import { useSendDM } from './useSendDM';
import { useMemo, useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';
import { logger } from '@/lib/logger';
import type { NostrEvent } from '@nostrify/nostrify';

// Extended NostrEvent type for optimistic updates
interface OptimisticNostrEvent extends NostrEvent {
  isSending?: boolean;
  clientFirstSeen?: number;
}

// NIP-17 message store interface
interface ConversationCandidate {
  id: string;
  pubkey: string;
  lastMessage?: NostrEvent;
  lastActivity: number;
  hasNIP4Messages: boolean;
  hasNIP17Messages: boolean;
  recentMessages: NostrEvent[];
}

interface NIP17MessageStore {
  conversations: Map<string, ConversationCandidate>;
  allMessages: Map<string, NostrEvent[]>;
}

// Message protocol types
export const MESSAGE_PROTOCOL = {
  NIP04: 'NIP04',
  NIP17: 'NIP17', 
  UNKNOWN: 'UNKNOWN'
} as const;

export type MessageProtocol = typeof MESSAGE_PROTOCOL[keyof typeof MESSAGE_PROTOCOL];

// Message sending parameters
export interface SendMessageParams {
  recipientPubkey: string;
  content: string;
  protocol?: MessageProtocol; // Optional - defaults to NIP-04 for now
}

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
    textColor: 'text-orange-600 dark:text-orange-400',
    label: 'NIP-04',
    title: 'NIP-04 encrypted message'
  },
  [MESSAGE_PROTOCOL.NIP17]: {
    color: 'bg-purple-500',
    textColor: 'text-purple-600 dark:text-purple-400',
    label: 'NIP-17',
    title: 'NIP-44/NIP-17 encrypted message'
  },
  [MESSAGE_PROTOCOL.UNKNOWN]: {
    color: 'bg-gray-400',
    textColor: 'text-gray-600 dark:text-gray-400',
    label: 'Unknown',
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
  const { sendNIP4Message, sendNIP17Message } = useSendDM();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  
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
    
    // Add friend-based conversations first (for discovery, but messages will be overridden)
    friendBasedConvos.forEach(conv => {
      conversationMap.set(conv.pubkey, {
        id: conv.pubkey,
        name: undefined,
        picture: undefined,
        lastMessage: conv.lastMessage, // This is encrypted, will be overridden by comprehensive scans
        lastActivity: conv.lastActivity,
        unreadCount: 0,
        hasNIP4Messages: conv.hasNIP4Messages,
        hasNIP17Messages: conv.hasNIP17Messages,
        recentMessages: [], // Friend-based discovery doesn't include message content
      });
    });
    
    // Add comprehensive NIP-4 conversations (OVERRIDE existing ones with decrypted data)
    nip4ComprehensiveConvos.forEach(conv => {
      const existing = conversationMap.get(conv.pubkey);
      if (!existing) {
        // New conversation from NIP-4 only
        conversationMap.set(conv.pubkey, {
          id: conv.pubkey,
          name: undefined,
          picture: undefined,
          lastMessage: conv.lastMessage, // Decrypted
          lastActivity: conv.lastActivity,
          unreadCount: 0,
          hasNIP4Messages: conv.hasNIP4Messages,
          hasNIP17Messages: conv.hasNIP17Messages,
          recentMessages: conv.recentMessages || [],
        });
      } else {
        // Override friend-based data with decrypted NIP-4 data
        existing.hasNIP4Messages = existing.hasNIP4Messages || conv.hasNIP4Messages;
        // Update with decrypted message if NIP-4 message is more recent or if existing is encrypted
        if (conv.lastActivity >= existing.lastActivity) {
          existing.lastMessage = conv.lastMessage; // Use decrypted message
          existing.lastActivity = conv.lastActivity;
        }
        existing.recentMessages = conv.recentMessages || [];
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

  // Memoize the conversation list data separately from progress data
  const conversationListData = useMemo(() => ({
    conversations: allConversations,
    isLoading: conversationList.isLoading || nip4AllConversations.isLoading || (isNIP17Enabled && nip17AllConversations.isLoading),
    // Comprehensive scanning status
    isLoadingComprehensive: nip4AllConversations.isLoading || (isNIP17Enabled && nip17AllConversations.isLoading),
  }), [
    allConversations,
    conversationList.isLoading,
    nip4AllConversations.isLoading,
    nip17AllConversations.isLoading,
    isNIP17Enabled
  ]);

  // Separate progress data that can update independently
  const progressData = useMemo(() => ({
    friendsProcessedCount: conversationList.processedCount,
    friendsTotalToProcess: conversationList.totalToProcess,
  }), [
    conversationList.processedCount,
    conversationList.totalToProcess,
  ]);

  const sendMessage = async (params: SendMessageParams) => {
    const { recipientPubkey, content, protocol = MESSAGE_PROTOCOL.NIP04 } = params;
    
    if (!user) {
      throw new Error('User must be logged in to send messages');
    }
    
    logger.log(`[DirectMessages] Sending message via ${protocol} to ${recipientPubkey}`);
    
    // Add optimistic update for NIP-17 messages
    if (protocol === MESSAGE_PROTOCOL.NIP17) {
      // Create optimistic message event
      const optimisticMessage: OptimisticNostrEvent = {
        id: `optimistic-${Date.now()}-${Math.random()}`,
        kind: 14, // Private DM
        content,
        tags: [['p', recipientPubkey]],
        created_at: Math.floor(Date.now() / 1000),
        pubkey: user.pubkey,
        sig: '',
        isSending: true, // Mark as optimistic
        clientFirstSeen: Date.now(), // For animation
      };

      // Add optimistic message to NIP-17 cache
      queryClient.setQueryData(['nip17-all-messages', user.pubkey], (oldData: NIP17MessageStore | undefined) => {
        if (!oldData) {
          return {
            conversations: new Map([[recipientPubkey, {
              id: recipientPubkey,
              pubkey: recipientPubkey,
              lastMessage: optimisticMessage,
              lastActivity: optimisticMessage.created_at,
              hasNIP4Messages: false,
              hasNIP17Messages: true,
              recentMessages: [optimisticMessage],
            }]]),
            allMessages: new Map([[recipientPubkey, [optimisticMessage]]]),
          };
        }

        const updatedConversations = new Map(oldData.conversations);
        const updatedAllMessages = new Map(oldData.allMessages);
        
        // Add to message history
        const existingMessages = updatedAllMessages.get(recipientPubkey) || [];
        const newMessages = [...existingMessages, optimisticMessage].sort((a, b) => a.created_at - b.created_at);
        updatedAllMessages.set(recipientPubkey, newMessages);
        
        // Update conversation summary
        const existingConvo = updatedConversations.get(recipientPubkey);
        if (existingConvo) {
          const updatedConvo: ConversationCandidate = {
            ...existingConvo,
            lastMessage: optimisticMessage,
            lastActivity: optimisticMessage.created_at,
            recentMessages: newMessages
              .sort((a, b) => b.created_at - a.created_at)
              .slice(0, 10),
          };
          updatedConversations.set(recipientPubkey, updatedConvo);
        } else {
          updatedConversations.set(recipientPubkey, {
            id: recipientPubkey,
            pubkey: recipientPubkey,
            lastMessage: optimisticMessage,
            lastActivity: optimisticMessage.created_at,
            hasNIP4Messages: false,
            hasNIP17Messages: true,
            recentMessages: [optimisticMessage],
          });
        }
        
        return {
          conversations: updatedConversations,
          allMessages: updatedAllMessages,
        };
      });

      // Send the actual message
      return await sendNIP17Message.mutateAsync({
        recipientPubkey,
        content,
      });
    }
    
    // Add optimistic update for NIP-04 messages
    if (protocol === MESSAGE_PROTOCOL.NIP04) {
      // Create optimistic message event
      const optimisticMessage: OptimisticNostrEvent = {
        id: `optimistic-${Date.now()}-${Math.random()}`,
        kind: 4, // NIP-04 encrypted DM
        content, // Store unencrypted content for display
        tags: [['p', recipientPubkey]],
        created_at: Math.floor(Date.now() / 1000),
        pubkey: user.pubkey,
        sig: '',
        isSending: true, // Mark as optimistic
        clientFirstSeen: Date.now(), // For animation
      };

      // Add optimistic message to NIP-4 cache
      const nip4QueryKey = ['nip4-messages', user.pubkey, recipientPubkey, undefined];
      queryClient.setQueryData(nip4QueryKey, (oldMessages: OptimisticNostrEvent[] | undefined) => {
        if (!oldMessages) {
          return [optimisticMessage];
        }
        return [...oldMessages, optimisticMessage].sort((a, b) => a.created_at - b.created_at);
      });

      // Send the actual message
      return await sendNIP4Message.mutateAsync({
        recipientPubkey,
        content,
      });
    }
    
    throw new Error(`Unsupported protocol: ${protocol}`);
  };

  return {
    // Direct data access (no function calls needed)
    conversations: conversationListData,
    progress: progressData,
    
    // Settings
    isNIP17Enabled,
    setNIP17Enabled,
    
    // Methods for specific operations
    getChatMessages,
    sendMessage,
    
    // Legacy function for backward compatibility (deprecated)
    getConversationList: () => conversationListData,
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
  const nip17Messages = useNIP17ConversationData(isNIP17Enabled ? conversationId : '', until); // Lightweight data access (no subscription recreation)
  
  logger.log(`[DMCHAT] useDirectMessagesForChat called with conversationId: "${conversationId}", until: ${until}`);
  logger.log(`[DMCHAT] isNIP17Enabled: ${isNIP17Enabled}`);
  logger.log(`[DMCHAT] NIP-4 messages loading: ${nip4Messages.isLoading}, count: ${nip4Messages.messages?.length || 0}`);
  logger.log(`[DMCHAT] NIP-17 messages loading: ${nip17Messages.isLoading}, count: ${nip17Messages.messages?.length || 0}`);
  
  // Memoize the message arrays to prevent unnecessary re-renders
  const stableNip4Messages = useMemo(() => (nip4Messages.messages as NostrEvent[]) || [], [nip4Messages.messages]);
  const stableNip17Messages = useMemo(() => nip17Messages.messages || [], [nip17Messages.messages]);

  // Combine, sort, and limit messages from both sources
  const combinedResult = useMemo(() => {
    // how many messages to show at first, and to fetch each time we press 'load older messages'
    const MESSAGES_PER_PAGE = 25;
    
    const nip4Count = stableNip4Messages.length;
    const nip17Count = stableNip17Messages.length;
    
    logger.log(`[DMCHAT] Combining messages: NIP-4 (${nip4Count}), NIP-17 (${nip17Count})`);
    
    // Combine all messages
    const combined = [...stableNip4Messages, ...stableNip17Messages];
    
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
  }, [stableNip4Messages, stableNip17Messages, nip4Messages.hasMoreMessages, nip17Messages.hasMoreMessages]);

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

  // Clear state when conversation changes
  useEffect(() => {
    setAllMessages([]);
    setUntil(undefined);
    setIsLoadingOlder(false);
  }, [conversationId]);

  // When new messages arrive, append them to our accumulator
  useEffect(() => {
    if (!currentPage.isLoading && currentPage.data.length > 0) {
      // Add logging to debug the race condition
      console.log(`[DEBUG] Setting messages for conversation: ${conversationId}`);
      console.log(`[DEBUG] Messages received:`, currentPage.data.map(m => ({ id: m.id, pubkey: m.pubkey, content: m.content.slice(0, 50) })));
      
      setAllMessages(prev => {
        // If this is the first load (until is undefined), replace all messages
        if (until === undefined) {
          console.log(`[DEBUG] First load - replacing all messages`);
          return currentPage.data;
        }
        // Otherwise, prepend older messages (they should be in chronological order)
        const newOlderMessages = currentPage.data.filter(msg => 
          !prev.some(existing => existing.id === msg.id)
        );
        console.log(`[DEBUG] Adding ${newOlderMessages.length} older messages`);
        return [...newOlderMessages, ...prev];
      });
      setIsLoadingOlder(false);
    }
  }, [currentPage.data, currentPage.isLoading, until, conversationId]);

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