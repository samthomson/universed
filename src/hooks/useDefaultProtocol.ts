import { useMemo } from 'react';
import { useDirectMessages, MESSAGE_PROTOCOL } from './useDirectMessages';
import { useDefaultProtocolSetting } from './useDefaultProtocolSetting';

/**
 * Hook to determine the default protocol for a conversation based on user settings
 * and conversation history.
 */
export function useDefaultProtocol(conversationId?: string) {
  const [defaultProtocolSetting] = useDefaultProtocolSetting();
  const { isNIP17Enabled, conversations } = useDirectMessages();

  return useMemo(() => {
    // If NIP-17 is disabled, always use NIP-04
    if (!isNIP17Enabled) {
      return MESSAGE_PROTOCOL.NIP04;
    }

    // Handle explicit protocol preferences
    if (defaultProtocolSetting === 'nip04') {
      return MESSAGE_PROTOCOL.NIP04;
    }
    
    if (defaultProtocolSetting === 'nip17') {
      return MESSAGE_PROTOCOL.NIP17;
    }

    // Auto mode: smart selection based on conversation history
    if (defaultProtocolSetting === 'auto' && conversationId && conversations?.conversations) {
      const conversation = conversations.conversations.find(c => c.id === conversationId);
      
      if (conversation) {
        // If conversation has NIP-17 messages, prefer NIP-17
        if (conversation.hasNIP17Messages) {
          return MESSAGE_PROTOCOL.NIP17;
        }
        
        // If conversation has NIP-04 messages but no NIP-17, use NIP-04
        if (conversation.hasNIP4Messages) {
          return MESSAGE_PROTOCOL.NIP04;
        }
      }
      
      // For new conversations with no history, default to NIP-17 (highest encryption)
      return MESSAGE_PROTOCOL.NIP17;
    }

    // Fallback to NIP-17 if NIP-17 is enabled
    return MESSAGE_PROTOCOL.NIP17;
  }, [defaultProtocolSetting, isNIP17Enabled, conversationId, conversations?.conversations]);
}
