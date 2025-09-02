// DEPRECATED: This file has been replaced by DataManagerProvider
// Kept for reference only - do not use in new code
// 
// This hook was previously used for NIP-4 direct messages but has been
// consolidated into the DataManager system for better performance and
// unified state management.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { validateDMEvent } from '@/lib/dmUtils';
import { logger } from '@/lib/logger';
import { reactQueryConfigs } from '@/lib/reactQueryConfigs';
import { useMemo, useEffect, useRef, useCallback } from 'react';

import type { NostrEvent } from '@/types/nostr';
import type { NUser } from '@nostrify/react/login';
import { PROTOCOL_CONSTANTS } from './_useDirectMessages';

interface ConversationCandidate {
  id: string;
  pubkey: string;
  lastMessage?: NostrEvent;
  lastActivity: number;
  hasNIP4Messages: boolean;
  hasNIP17Messages: boolean;
  recentMessages: NostrEvent[]; // Store recent messages for instant chat loading
}

// Constants for comprehensive scanning (internal to this hook)
const SCAN_TOTAL_LIMIT = 20000;  // Maximum total messages to process (increased from 5000)
const SCAN_BATCH_SIZE = 1000;    // Messages per batch request (increased from 500)  
const MESSAGES_PER_CHAT = 10;     // Recent messages to keep per conversation

// Constants for conversation pagination
const CONVERSATION_BATCH_SIZE = 1000;  // Messages per batch for conversation mode
const MAX_CONVERSATION_MESSAGES = 50000; // Maximum messages to fetch per conversation

// Consider messages "recent" if they're less than 10 seconds old
const RECENT_MESSAGE_THRESHOLD = 10000; // 10 seconds

/**
 * DEPRECATED: Use DataManagerProvider instead
 * 
 * Fetch all NIP-4 messages for a conversation up to a specific timestamp using batching
 */
async function fetchAllMessagesUntil(
  conversationId: string,
  user: NUser,
  nostr: ReturnType<typeof useNostr>['nostr'],
  signal: AbortSignal,
  until?: number
): Promise<{ messages: NostrEvent[], hasMore: boolean }> {
  // Implementation removed - use DataManagerProvider instead
  return { messages: [], hasMore: false };
}

/**
 * DEPRECATED: Use DataManagerProvider instead
 * 
 * Hook for NIP-4 (Kind 4) direct messages.
 * Handles legacy encrypted DMs with efficient participant filtering.
 * Can also discover all conversations when isDiscoveryMode is true.
 */
export function useNIP4DirectMessages(conversationId: string, isDiscoveryMode = false, until?: number) {
  // This hook is deprecated - use DataManagerProvider instead
  console.warn('useNIP4DirectMessages is deprecated. Use DataManagerProvider instead.');
  
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
