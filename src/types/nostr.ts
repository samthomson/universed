import type { NostrEvent as BaseNostrEvent } from '@nostrify/nostrify';

/**
 * Extended NostrEvent that includes optional client-side UI state.
 * This is a minimal extension that preserves the standard NostrEvent interface.
 */
export interface NostrEvent extends BaseNostrEvent {
  /**
   * Optional client-side property indicating if this message is currently being sent.
   * Only present on optimistic messages before relay confirmation.
   */
  isSending?: boolean;
  
  /**
   * Optional client-side property indicating when this message first appeared in real-time.
   * Only set for messages received via subscription, not historical loads.
   */
  clientFirstSeen?: number;
}
