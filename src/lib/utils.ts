import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate an naddr string from a community event
 */
export function generateCommunityNaddr(event: NostrEvent): string {
  const d = event.tags.find(([name]) => name === 'd')?.[1] || '';
  const relays: string[] = []; // Could be populated from event tags if needed

  return nip19.naddrEncode({
    kind: event.kind,
    pubkey: event.pubkey,
    identifier: d,
    relays,
  });
}
