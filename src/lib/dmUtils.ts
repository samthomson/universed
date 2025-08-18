import type { NostrEvent } from '@nostrify/nostrify';

export interface DMConversation {
  id: string; // The other person's pubkey
  pubkey: string;
  lastMessage?: NostrEvent;
  lastMessageTime: number;
  unreadCount: number;
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
