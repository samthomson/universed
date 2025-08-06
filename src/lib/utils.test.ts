import { describe, it, expect } from 'vitest';
import { generateCommunityNaddr } from './utils';
import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';

describe('generateCommunityNaddr', () => {
  it('should generate correct naddr for community event', () => {
    const mockEvent: NostrEvent = {
      id: 'test-event-id',
      pubkey: '0000000000000000000000000000000000000000000000000000000000000001',
      created_at: 1234567890,
      kind: 34550,
      tags: [
        ['d', 'test-community-id'],
        ['name', 'Test Community'],
        ['description', 'A test community'],
      ],
      content: '',
      sig: 'test-signature',
    };

    const naddr = generateCommunityNaddr(mockEvent);

    expect(naddr).toMatch(/^naddr1/);

    // Decode the naddr to verify its contents
    const decoded = nip19.decode(naddr);
    expect(decoded.type).toBe('naddr');
    if (decoded.type === 'naddr') {
      expect(decoded.data.kind).toBe(34550);
      expect(decoded.data.pubkey).toBe('0000000000000000000000000000000000000000000000000000000000000001');
      expect(decoded.data.identifier).toBe('test-community-id');
    }
  });

  it('should handle community event without d tag', () => {
    const mockEvent: NostrEvent = {
      id: 'test-event-id',
      pubkey: '0000000000000000000000000000000000000000000000000000000000000001',
      created_at: 1234567890,
      kind: 34550,
      tags: [
        ['name', 'Test Community'],
        ['description', 'A test community'],
      ],
      content: '',
      sig: 'test-signature',
    };

    const naddr = generateCommunityNaddr(mockEvent);

    expect(naddr).toMatch(/^naddr1/);

    // Decode the naddr to verify its contents
    const decoded = nip19.decode(naddr);
    expect(decoded.type).toBe('naddr');
    if (decoded.type === 'naddr') {
      expect(decoded.data.kind).toBe(34550);
      expect(decoded.data.pubkey).toBe('0000000000000000000000000000000000000000000000000000000000000001');
      expect(decoded.data.identifier).toBe(''); // Empty identifier when no d tag
    }
  });
});