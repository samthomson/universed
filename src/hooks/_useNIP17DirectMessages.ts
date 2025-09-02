// DEPRECATED: This file has been replaced by DataManagerProvider
// Kept for reference only - do not use in new code
// 
// This hook was previously used for NIP-17 direct messages but has been
// consolidated into the DataManager system for better performance and
// unified state management.

import { useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { logger } from '@/lib/logger';
import { reactQueryConfigs } from '@/lib/reactQueryConfigs';
import { useEffect, useRef, useMemo } from 'react';

import type { NostrEvent } from '@/types/nostr';
import type { NUser } from '@nostrify/react/login';
import { PROTOCOL_CONSTANTS } from './_useDirectMessages';

// Extended NostrEvent type for optimistic updates
interface OptimisticNostrEvent extends NostrEvent {
  isSending?: boolean;
  clientFirstSeen?: number;
}

interface ConversationCandidate {
  id: string;
  pubkey: string;
  lastMessage?: NostrEvent;
  lastActivity: number;
  hasNIP4Messages: boolean;
  hasNIP17Messages: boolean;
  recentMessages: NostrEvent[]; // Store recent messages for instant chat loading
}

interface NIP17MessageStore {
  conversations: Map<string, ConversationCandidate>;
  allMessages: Map<string, OptimisticNostrEvent[]>; // pubkey -> messages for that conversation (can include optimistic)
}

// Constants for NIP-17 scanning (internal to this hook)
const SCAN_TOTAL_LIMIT = 20000;  // Maximum total messages to process
const SCAN_BATCH_SIZE = 1000;    // Messages per batch request
const _SUMMARY_MESSAGES_PER_CHAT = 10;    // Recent messages to show in conversation summaries (same as NIP-4)

/**
 * DEPRECATED: Use DataManagerProvider instead
 * 
 * Shared function to decrypt a NIP-17 Gift Wrap message
 * Returns the decrypted message and conversation partner, or null if failed
 */
async function decryptGiftWrapMessage(
  giftWrap: NostrEvent,
  user: NUser
): Promise<{ messageEvent: NostrEvent; conversationPartner: string } | null> {
  // Implementation removed - use DataManagerProvider instead
  return null;
}

/**
 * DEPRECATED: Use DataManagerProvider instead
 * 
 * Process a new Gift Wrap message from real-time subscription
 * Similar to handleNewMessage in useMessages.ts but for NIP-17 DMs
 */
async function processNewGiftWrapMessage(
  giftWrap: NostrEvent, 
  user: NUser, 
  queryClient: QueryClient
): Promise<void> {
  // Implementation removed - use DataManagerProvider instead
}

/**
 * DEPRECATED: Use DataManagerProvider instead
 * 
 * Hook for NIP-17 (Kind 14 wrapped in Kind 1059) direct messages.
 * Unlike NIP-4, this fetches ALL NIP-17 messages for the user and provides both:
 * 1. Conversation discovery (when isDiscoveryMode = true)
 * 2. Specific conversation messages (when conversationId is provided)
 */
export function useNIP17DirectMessages(conversationId: string, enabled: boolean, isDiscoveryMode = false, until?: number) {
  // This hook is deprecated - use DataManagerProvider instead
  console.warn('useNIP17DirectMessages is deprecated. Use DataManagerProvider instead.');
  
  return {
    conversations: [],
    messages: [],
    isLoading: false,
    isError: false,
    hasMoreMessages: false,
    loadingOlderMessages: false,
    loadOlderMessages: async () => {},
    reachedStartOfConversation: true,
  };
}
