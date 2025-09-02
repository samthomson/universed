// DEPRECATED: This file has been replaced by DataManagerProvider
// Kept for reference only - do not use in new code
// 
// This hook was previously used for NIP-17 conversation data access but has been
// consolidated into the DataManager system for better performance and
// unified state management.

import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';
import { useMemo } from 'react';
import type { NostrEvent } from '@/types/nostr';
import { PROTOCOL_CONSTANTS } from './_useDirectMessages';

interface ConversationCandidate {
  id: string;
  pubkey: string;
  lastMessage?: NostrEvent;
  lastActivity: number;
  hasNIP4Messages: boolean;
  hasNIP17Messages: boolean;
  recentMessages: NostrEvent[];
}

interface _NIP17MessageStore {
  conversations: Map<string, ConversationCandidate>;
  allMessages: Map<string, NostrEvent[]>; // pubkey -> messages for that conversation
}

/**
 * DEPRECATED: Use DataManagerProvider instead
 * 
 * Lightweight hook to access NIP-17 conversation data without creating subscriptions.
 * This reads from the global NIP-17 cache managed by useNIP17DirectMessages in discovery mode.
 */
export function useNIP17ConversationData(conversationId: string, until?: number) {
  // This hook is deprecated - use DataManagerProvider instead
  console.warn('useNIP17ConversationData is deprecated. Use DataManagerProvider instead.');
  
  return {
    messages: [],
    isLoading: false,
    hasMoreMessages: false,
    loadingOlderMessages: false,
    loadOlderMessages: async () => {},
    reachedStartOfConversation: true,
  };
}
