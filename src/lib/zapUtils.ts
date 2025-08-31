import { nip57 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Creates a zap request using the simplified approach.
 * The nip57.makeZapRequest function handles the logic for different event types automatically.
 */
export function createZapRequest(params: {
  event: NostrEvent;
  amount: number; // in millisats
  relays: string[];
  comment?: string;
}) {
  return nip57.makeZapRequest({
    profile: params.event.pubkey,
    event: params.event,
    amount: params.amount,
    relays: params.relays,
    comment: params.comment || '',
  });
}

/**
 * Extracts the satoshi amount from a zap receipt event using multiple methods.
 * Returns 0 if amount cannot be determined.
 */
export function extractZapAmount(zap: NostrEvent): number {
  // Method 1: amount tag (from zap request, sometimes copied to receipt)
  const amountTag = zap.tags.find(([name]) => name === 'amount')?.[1];
  if (amountTag) {
    const millisats = parseInt(amountTag);
    return Math.floor(millisats / 1000);
  }

  // Method 2: Extract from bolt11 invoice
  const bolt11Tag = zap.tags.find(([name]) => name === 'bolt11')?.[1];
  if (bolt11Tag) {
    try {
      return nip57.getSatoshisAmountFromBolt11(bolt11Tag);
    } catch (error) {
      console.warn('Failed to parse bolt11 amount:', error);
    }
  }

  // Method 3: Parse from description (zap request JSON)
  const descriptionTag = zap.tags.find(([name]) => name === 'description')?.[1];
  if (descriptionTag) {
    try {
      const zapRequest = JSON.parse(descriptionTag);
      const requestAmountTag = zapRequest.tags?.find(([name]: string[]) => name === 'amount')?.[1];
      if (requestAmountTag) {
        const millisats = parseInt(requestAmountTag);
        return Math.floor(millisats / 1000);
      }
    } catch (error) {
      console.warn('Failed to parse description JSON:', error);
    }
  }

  console.warn('Could not extract amount from zap receipt:', zap.id);
  return 0;
}

/**
 * Extracts zap comment from a zap receipt event.
 * Returns empty string if no comment is found.
 */
export function extractZapComment(zap: NostrEvent): string {
  const descriptionTag = zap.tags.find(([name]) => name === 'description')?.[1];
  if (descriptionTag) {
    try {
      const zapRequest = JSON.parse(descriptionTag);
      return zapRequest.content || '';
    } catch (error) {
      console.warn('Failed to parse description JSON:', error);
    }
  }
  return '';
}