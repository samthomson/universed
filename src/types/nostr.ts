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
}
