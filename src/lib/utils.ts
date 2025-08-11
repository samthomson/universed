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

/**
 * Parse a community ID in format "kind:pubkey:d-tag" and return naddr
 */
export function communityIdToNaddr(communityId: string): string {
  const [kind, pubkey, d] = communityId.split(':');
  if (!kind || !pubkey || !d) {
    throw new Error('Invalid community ID format');
  }

  return nip19.naddrEncode({
    kind: parseInt(kind, 10),
    pubkey,
    identifier: d,
    relays: [],
  });
}

/**
 * Generate a random channel identifier from a custom name
 * Format: my-custom-name-rand
 */
export function generateChannelIdentifier(customName: string): string {
  // Clean the custom name: lowercase, replace spaces and special chars with hyphens
  const cleanedName = customName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim();

  // Generate random 4-character alphanumeric string
  const randomChars = Math.random().toString(36).substring(2, 6);

  // Combine: cleaned-name-rand
  return `${cleanedName}-${randomChars}`;
}

/**
 * Decode an naddr and return community ID in format "kind:pubkey:d-tag"
 */
export function naddrToCommunityId(naddr: string): string {
  try {
    const decoded = nip19.decode(naddr);
    if (decoded.type !== 'naddr') {
      throw new Error('Not an naddr identifier');
    }

    const { kind, pubkey, identifier } = decoded.data;
    return `${kind}:${pubkey}:${identifier}`;
  } catch {
    throw new Error('Invalid naddr format');
  }
}

/**
 * Check if a string is a community ID in format "kind:pubkey:d-tag"
 */
export function isCommunityId(value: string): boolean {
  return /^\d+:[a-f0-9]{64}:[^:]+$/.test(value);
}

/**
 * Check if a string is an naddr
 */
export function isNaddr(value: string): boolean {
  try {
    const decoded = nip19.decode(value);
    return decoded.type === 'naddr';
  } catch {
    return false;
  }
}
