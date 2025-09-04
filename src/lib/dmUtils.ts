import type { NostrEvent } from '@nostrify/nostrify';
import type { DecryptedMessage } from '@/types/nostr';

export interface DMConversation {
  id: string; // The other person's pubkey
  pubkey: string;
  lastMessage?: DecryptedMessage;
  lastMessageTime: number;
  unreadCount: number;
  // Conversation categorization
  isKnown?: boolean; // User has sent at least one message to this person
  isRequest?: boolean; // Other person has sent messages, but user hasn't replied
  // Reply status tracking
  lastMessageFromUser?: boolean; // True if user sent the last message, false if other person did
}

/**
 * Shared validation function for DM events
 */
export function validateDMEvent(event: NostrEvent): boolean {
  // Accept both NIP-04 (kind 4) and NIP-44 (kind 1059) encrypted DMs
  if (![4, 1059].includes(event.kind)) return false;

  // Must have a 'p' tag for the recipient
  const hasP = event.tags.some(([name]) => name === 'p');
  if (!hasP) return false;

  return true;
}
