import type { NostrEvent as BaseNostrEvent } from '@nostrify/nostrify';

/**
 * Extended NostrEvent that includes optional client-side UI state.
 * This is a minimal extension that preserves the standard NostrEvent interface.
 */
export interface NostrEvent extends BaseNostrEvent {
  isSending?: boolean;
  clientFirstSeen?: number;
}

// Extended message type for in-memory use with decrypted content
export interface DecryptedMessage extends NostrEvent {
  decryptedContent?: string;
  error?: string;
}
