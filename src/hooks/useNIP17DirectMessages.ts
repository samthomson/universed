/**
 * Hook for NIP-17 (Kind 14 wrapped in Kind 1059) direct messages.
 * Handles Gift Wrap decryption and conversation filtering.
 * Can also discover all conversations when isDiscoveryMode is true.
 */
export function useNIP17DirectMessages(conversationId: string, enabled: boolean, isDiscoveryMode = false) {
  // Early return if not enabled
  if (!enabled) {
    return isDiscoveryMode ? {
      conversations: [],
      isLoading: false,
      isError: false,
    } : {
      messages: [],
      isLoading: false,
      hasMoreMessages: false,
      loadingOlderMessages: false,
      loadOlderMessages: async () => {},
      reachedStartOfConversation: false,
    };
  }

  // TODO: Implement comprehensive NIP-17 scanning when isDiscoveryMode is true
  // This will be similar to NIP-4 but with Gift Wrap decryption
  
  if (isDiscoveryMode) {
    return {
      conversations: [],
      isLoading: false,
      isError: false,
    };
  } else {
    return {
      messages: [],
      isLoading: false,
      hasMoreMessages: false,
      loadingOlderMessages: false,
      loadOlderMessages: async () => {},
      reachedStartOfConversation: false,
    };
  }
}