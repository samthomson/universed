import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';
import { useMemo } from 'react';
import type { NostrEvent } from '@/types/nostr';

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
  allMessages: Map<string, NostrEvent[]>; // pubkey -> messages for that conversation
}

/**
 * Lightweight hook to access NIP-17 conversation data without creating subscriptions.
 * This reads from the global NIP-17 cache managed by useNIP17DirectMessages in discovery mode.
 */
export function useNIP17ConversationData(conversationId: string, until?: number) {
  const { user } = useCurrentUser();

  // Use a reactive query to watch for cache changes
  const query = useQuery({
    queryKey: ['nip17-all-messages', user?.pubkey],
    queryFn: () => {
      // This should never be called since the data is managed by useNIP17DirectMessages
      // But we need a queryFn for TypeScript
      return { conversations: new Map(), allMessages: new Map() };
    },
    enabled: false, // Don't fetch, just watch cache
    staleTime: Infinity, // Never consider stale
  });

  return useMemo(() => {
    if (!user?.pubkey || !conversationId) {
      return {
        messages: [],
        isLoading: false,
        hasMoreMessages: false,
        loadingOlderMessages: false,
        loadOlderMessages: async () => {},
        reachedStartOfConversation: true,
      };
    }

    // Get the global NIP-17 data from the reactive query
    const nip17Data = query.data;
    
    if (!nip17Data) {
      return {
        messages: [],
        isLoading: false, // Don't block on missing cache data - let NIP-4 messages show
        hasMoreMessages: false,
        loadingOlderMessages: false,
        loadOlderMessages: async () => {},
        reachedStartOfConversation: true,
      };
    }

    // Get messages for this specific conversation
    const allConversationMessages = nip17Data.allMessages.get(conversationId) || [];
    
    // Apply timestamp filter if provided (for pagination)
    const filteredMessages = until 
      ? allConversationMessages.filter(msg => msg.created_at < until)
      : allConversationMessages;
    
    // Sort by timestamp (oldest first) and take up to 100 messages
    const sortedMessages = filteredMessages
      .sort((a, b) => a.created_at - b.created_at)
      .slice(-100); // Take the 100 most recent messages before the 'until' timestamp
    
    return {
      messages: sortedMessages,
      isLoading: false,
      hasMoreMessages: filteredMessages.length > sortedMessages.length, // More available if we filtered some out
      loadingOlderMessages: false,
      loadOlderMessages: async () => {}, // Pagination is handled by the chat hook
      reachedStartOfConversation: filteredMessages.length <= sortedMessages.length,
    };
  }, [user?.pubkey, conversationId, until, query.data]);
}
