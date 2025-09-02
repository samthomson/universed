// DEPRECATED: This file has been replaced by DataManagerProvider
// Kept for reference only - do not use in new code
// 
// This hook was previously used for direct messages but has been
// consolidated into the DataManager system for better performance and
// unified state management.

import { useLocalStorage } from './useLocalStorage';
import { useConversationList } from './useConversationList';
import { useNIP4DirectMessages } from './_useNIP4DirectMessages';
import { useNIP17DirectMessages } from './_useNIP17DirectMessages';
import { useNIP17ConversationData } from './_useNIP17ConversationData';
import { useSendDM } from './useSendDM';
import { useMemo, useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';
import { logger } from '@/lib/logger';
import type { NostrEvent } from '@nostrify/nostrify';

// Import ConversationCandidate type from NIP4 hook
interface ConversationCandidate {
  id: string;
  pubkey: string;
  lastMessage?: NostrEvent;
  lastActivity: number;
  hasNIP4Messages: boolean;
  hasNIP17Messages: boolean;
  recentMessages: NostrEvent[];
}

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
  // Conversation categorization
  isKnown: boolean; // User has sent at least one message to this person
  isRequest: boolean; // Other person has sent messages, but user hasn't replied
  // Reply status tracking
  lastMessageFromUser: boolean; // True if user sent the last message, false if other person did
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

// Constants for consistent naming across the app
export const PROTOCOL_CONSTANTS = {
  // localStorage keys
  NIP17_ENABLED_KEY: 'enableNIP17',
  
  // Query keys
  NIP4_MESSAGES_KEY: 'nip4-messages',
  NIP17_MESSAGES_KEY: 'nip17-all-messages',
  NIP4_CONVERSATIONS_KEY: 'nip4-all-conversations',
  
  // Logger prefixes
  NIP4_LOG_PREFIX: 'DMS: [NIP4]',
  NIP17_LOG_PREFIX: 'DMS: [NIP17]',
  DMCHAT_LOG_PREFIX: 'DMS: [DMCHAT]',
  DIRECT_MESSAGES_LOG_PREFIX: 'DMS: [DirectMessages]',
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

// Helper function to analyze conversation and determine categorization
function analyzeConversation(conv: { recentMessages?: NostrEvent[]; pubkey: string; lastMessage?: NostrEvent }, userPubkey: string): {
  isKnown: boolean;
  isRequest: boolean;
  lastMessageFromUser: boolean;
} {
  const messages = conv.recentMessages || [];
  
  if (!messages.length) {
    // If no recent messages but conversation exists, assume it's known
    // (conservative approach - better to show in Known than miss a conversation)
    return { 
      isKnown: true, 
      isRequest: false, 
      lastMessageFromUser: false 
    };
  }

  // Check if user has sent any message in recent history
  const userHasSentMessage = messages.some((msg: NostrEvent) => msg.pubkey === userPubkey);
  
  // Determine categorization - simplified as suggested by colleague
  // The distinction is simply whether the user has sent a message to this person
  const isKnown = userHasSentMessage;
  const isRequest = !isKnown;
  
  // Who sent the last message?
  const lastMessage = conv.lastMessage;
  const lastMessageFromUser = lastMessage?.pubkey === userPubkey;

  return { isKnown, isRequest, lastMessageFromUser };
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
 * DEPRECATED: Use DataManagerProvider instead
 * 
 * Main orchestrator hook for direct messages.
 * Combines NIP-4 and NIP-17 messages and manages global DM settings.
 */
export function useDirectMessages() {
  // This hook is deprecated - use DataManagerProvider instead
  console.warn('useDirectMessages is deprecated. Use DataManagerProvider instead.');
  
  return {
    // Settings
    isNIP17Enabled: true,
    setNIP17Enabled: () => {},
    
    // Methods for specific operations
    sendMessage: async () => {
      throw new Error('useDirectMessages is deprecated. Use DataManagerProvider instead.');
    },
  };
}

/**
 * DEPRECATED: Use DataManagerProvider instead
 * 
 * Separate hook for individual chat message loading
 * Combines NIP-4 and NIP-17 messages for a specific conversation with timestamp-based pagination
 */
export function useDirectMessagesForChat(conversationId: string, until?: number) {
  // This hook is deprecated - use DataManagerProvider instead
  console.warn('useDirectMessagesForChat is deprecated. Use DataManagerProvider instead.');
  
  return {
    data: [],
    isLoading: false,
    hasMoreMessages: false,
    loadingOlderMessages: false,
    loadOlderMessages: async () => {},
    reachedStartOfConversation: true,
    oldestMessageTimestamp: undefined,
  };
}

/**
 * DEPRECATED: Use DataManagerProvider instead
 * 
 * Stateful wrapper hook for chat pagination
 * Manages the 'until' timestamp internally and provides loadOlderMessages function
 */
export function useDirectMessagesForChatWithPagination(conversationId: string) {
  // This hook is deprecated - use DataManagerProvider instead
  console.warn('useDirectMessagesForChatWithPagination is deprecated. Use DataManagerProvider instead.');
  
  return {
    data: [],
    isLoading: false,
    hasMoreMessages: false,
    loadingOlderMessages: false,
    loadOlderMessages: async () => {},
    reachedStartOfConversation: true,
  };
}
