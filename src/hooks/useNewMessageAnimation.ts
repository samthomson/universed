import type { NostrEvent } from '@/types/nostr';

const ANIMATION_DURATION = 2000; // 2 seconds

/**
 * Check if a message should show the new message animation
 */
export function isNewMessage(message: NostrEvent): boolean {
  if (!message.clientFirstSeen || message.isSending) {
    return false;
  }
  
  const age = Date.now() - message.clientFirstSeen;
  return age < ANIMATION_DURATION;
}