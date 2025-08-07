import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@/types/nostr';

interface MarketplaceItemData {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  seller: string;
  location?: string;
  category: string;
  condition: 'new' | 'used' | 'refurbished';
  createdAt: number;
  event: NostrEvent;
  communityId: string;
}

/**
 * Generates a special message content for marketplace item references in DMs
 * This creates a structured format that can be parsed and rendered as a card
 */
export function createMarketplaceItemMessage(item: MarketplaceItemData): string {
  // Create a structured JSON message that contains all the item data
  const messageData = {
    type: 'marketplace_item',
    item: {
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      currency: item.currency,
      images: item.images,
      seller: item.seller,
      location: item.location,
      category: item.category,
      condition: item.condition,
      createdAt: item.createdAt,
      communityId: item.communityId,
    },
    // Generate naddr for the marketplace item for linking back
    naddr: nip19.naddrEncode({
      kind: 30018, // NIP-15 product event
      pubkey: item.seller,
      identifier: item.id,
      relays: [], // Will use user's preferred relays
    }),
  };

  // Create a human-readable message with embedded JSON data
  const humanMessage = `🛒 Interested in: ${item.name} - ${formatPrice(item.price, item.currency)}`;
  
  // Combine human-readable message with structured data
  return `${humanMessage}\n\n${JSON.stringify(messageData)}`;
}

/**
 * Parses a DM message to check if it contains a marketplace item reference
 * Returns the parsed item data if found, null otherwise
 */
export function parseMarketplaceItemMessage(content: string): MarketplaceItemData | null {
  try {
    // Look for JSON data at the end of the message
    const lines = content.split('\n');
    const jsonLine = lines.find(line => line.trim().startsWith('{'));
    
    if (!jsonLine) return null;
    
    const parsed = JSON.parse(jsonLine);
    
    if (parsed.type === 'marketplace_item' && parsed.item) {
      return parsed.item as MarketplaceItemData;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Checks if a message contains a marketplace item reference
 */
export function isMarketplaceItemMessage(content: string): boolean {
  return parseMarketplaceItemMessage(content) !== null;
}

/**
 * Extracts the human-readable part of a marketplace item message
 */
export function extractHumanReadableMessage(content: string): string {
  const lines = content.split('\n');
  // Find the first non-empty line that doesn't start with '{'
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('{')) {
      return trimmed;
    }
  }
  return 'Marketplace item reference';
}

function formatPrice(price: number, currency: string): string {
  if (currency === 'sats') {
    return `${price.toLocaleString()} sats`;
  }
  if (currency === 'btc') {
    return `₿${price}`;
  }
  return `${price} ${currency.toUpperCase()}`;
}