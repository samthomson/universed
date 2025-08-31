import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Validates that an event is a proper reaction event.
 * - Must be kind 7
 * - Must have an 'e' tag pointing to the target event
 */
export function validateReactionEvent(event: NostrEvent): boolean {
  if (event.kind !== 7) return false;
  const hasETag = event.tags.some(([name]) => name === 'e');
  if (!hasETag) return false;
  return true;
}

/**
 * Validates that an event is a proper zap receipt event.
 * - Must be kind 9735
 * - Must have an 'e' tag pointing to the target event
 */
export function validateZapEvent(event: NostrEvent): boolean {
  if (event.kind !== 9735) return false;
  const hasETag = event.tags.some(([name]) => name === 'e');
  if (!hasETag) return false;
  return true;
}