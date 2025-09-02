import { useMemo } from 'react';
import { useDirectMessages, MESSAGE_PROTOCOL } from './useDirectMessages';

/**
 * Hook to automatically determine the best protocol for a conversation.
 * Uses NIP-17 by default, falls back to NIP-04 when needed.
 */
export function useAutoProtocol(conversationId?: string) {
  const { isNIP17Enabled, conversations } = useDirectMessages();

  return useMemo(() => {
    // If NIP-17 is disabled, use NIP-04
    if (!isNIP17Enabled) {
      return MESSAGE_PROTOCOL.NIP04;
    }

    // Auto mode: determine protocol based on conversation history
    if (conversationId) {
      const conversation = conversations?.conversations?.find(c => c.id === conversationId);
      
      // If conversation has NIP-17 messages, continue using NIP-17
      if (conversation?.hasNIP17Messages) {
        return MESSAGE_PROTOCOL.NIP17;
      }
      
      // If conversation only has NIP-04 messages, use NIP-04 for compatibility
      if (conversation?.hasNIP4Messages && !conversation?.hasNIP17Messages) {
        return MESSAGE_PROTOCOL.NIP04;
      }
    }

    // Default to NIP-17 for new conversations or when NIP-17 is enabled
    return MESSAGE_PROTOCOL.NIP17;
  }, [isNIP17Enabled, conversationId, conversations?.conversations]);
}