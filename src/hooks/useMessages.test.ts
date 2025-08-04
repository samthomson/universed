import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
// Import the function directly (assume it's exported for test)
import { validateMessageEvent } from './useMessages';

describe('validateMessageEvent', () => {
  const baseEvent = {
    id: 'id',
    pubkey: 'pubkey',
    created_at: 0,
    kind: 1,
    content: '',
    tags: [],
    sig: 'sig',
  } as NostrEvent;

  it('accepts kind 1 with no t-tag in general channel', () => {
    const event = { ...baseEvent, kind: 1, tags: [] };
    expect(validateMessageEvent(event, 'general')).toBe(true);
  });

  it('rejects kind 1 with no t-tag in non-general channel', () => {
    const event = { ...baseEvent, kind: 1, tags: [] };
    expect(validateMessageEvent(event, 'random')).toBe(false);
  });

  it('accepts kind 1 with correct t-tag', () => {
    const event = { ...baseEvent, kind: 1, tags: [['t', 'random']] };
    expect(validateMessageEvent(event, 'random')).toBe(true);
  });

  it('rejects kind 1 with incorrect t-tag', () => {
    const event = { ...baseEvent, kind: 1, tags: [['t', 'other']] };
    expect(validateMessageEvent(event, 'random')).toBe(false);
  });

  it('rejects kind 1 with e-tag', () => {
    const event = { ...baseEvent, kind: 1, tags: [['e', 'something']] };
    expect(validateMessageEvent(event, 'general')).toBe(false);
  });

  it('accepts kind 9411 with correct t-tag', () => {
    const event = { ...baseEvent, kind: 9411, tags: [['t', 'random']] };
    expect(validateMessageEvent(event, 'random')).toBe(true);
  });

  it('rejects kind 9411 with incorrect t-tag', () => {
    const event = { ...baseEvent, kind: 9411, tags: [['t', 'other']] };
    expect(validateMessageEvent(event, 'random')).toBe(false);
  });

  it('rejects kind 9411 with no t-tag', () => {
    const event = { ...baseEvent, kind: 9411, tags: [] };
    expect(validateMessageEvent(event, 'random')).toBe(false);
  });

  it('rejects kind 9411 with e-tag', () => {
    const event = { ...baseEvent, kind: 9411, tags: [['t', 'random'], ['e', 'something']] };
    expect(validateMessageEvent(event, 'random')).toBe(false);
  });

  it('rejects events with kind not 1 or 9411', () => {
    const event = { ...baseEvent, kind: 42, tags: [['t', 'random']] };
    expect(validateMessageEvent(event, 'random')).toBe(false);
  });
});