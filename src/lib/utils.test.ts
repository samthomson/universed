import { describe, it, expect } from 'vitest';
import { generateCommunityNaddr, communityIdToNaddr, naddrToCommunityId, isCommunityId, isNaddr } from './utils';
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

describe('communityIdToNaddr', () => {
  it('converts community ID to naddr format', () => {
    const communityId = '34550:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:test-community';
    const naddr = communityIdToNaddr(communityId);

    expect(naddr).toMatch(/^naddr1/);

    // Verify it can be decoded back
    const decoded = nip19.decode(naddr);
    expect(decoded.type).toBe('naddr');
    if (decoded.type === 'naddr') {
      expect(decoded.data.kind).toBe(34550);
      expect(decoded.data.pubkey).toBe('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
      expect(decoded.data.identifier).toBe('test-community');
    }
  });

  it('throws error for invalid community ID format', () => {
    expect(() => communityIdToNaddr('invalid-format')).toThrow();
    expect(() => communityIdToNaddr('34550:invalid-pubkey:test')).toThrow();
    expect(() => communityIdToNaddr('34550:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')).toThrow();
  });
});

describe('naddrToCommunityId', () => {
  it('converts naddr to community ID format', () => {
    const naddr = nip19.naddrEncode({
      kind: 34550,
      pubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      identifier: 'test-community',
      relays: [],
    });

    const communityId = naddrToCommunityId(naddr);
    expect(communityId).toBe('34550:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:test-community');
  });

  it('throws error for invalid naddr format', () => {
    expect(() => naddrToCommunityId('invalid-naddr')).toThrow();
    expect(() => naddrToCommunityId('npub123')).toThrow();
  });

  it('correctly handles round-trip encoding and decoding', () => {
    const originalCommunityId = '34550:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:test-community';

    // Encode to naddr
    const naddr = communityIdToNaddr(originalCommunityId);

    // Decode back to community ID
    const decodedCommunityId = naddrToCommunityId(naddr);

    // Should be the same as original
    expect(decodedCommunityId).toBe(originalCommunityId);
  });

  it('handles the specific failing naddr from the bug report', () => {
    const failingNaddr = 'naddr1qvzqqqyx7cpzq3e9jpmvshujgr59yssdwgfujh54zqh3m6fflds0xw3vxftsexxyqqtxv6tjwd6z6um0v9cxymmc945xzcmtv96x7msnz7k52';

    // This should not throw an error
    expect(() => {
      const decoded = naddrToCommunityId(failingNaddr);
      console.log('Decoded community ID:', decoded);
    }).not.toThrow();
  });
});

describe('isCommunityId', () => {
  it('returns true for valid community ID format', () => {
    expect(isCommunityId('34550:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:test-community')).toBe(true);
    expect(isCommunityId('10000:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:test')).toBe(true);
  });

  it('returns false for invalid community ID format', () => {
    expect(isCommunityId('invalid-format')).toBe(false);
    expect(isCommunityId('34550:invalid-pubkey:test')).toBe(false);
    expect(isCommunityId('34550:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')).toBe(false);
    expect(isCommunityId('naddr123')).toBe(false);
  });
});

describe('isNaddr', () => {
  it('returns true for valid naddr format', () => {
    const naddr = nip19.naddrEncode({
      kind: 34550,
      pubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      identifier: 'test-community',
      relays: [],
    });

    expect(isNaddr(naddr)).toBe(true);
  });

  it('returns false for invalid naddr format', () => {
    expect(isNaddr('invalid-naddr')).toBe(false);
    expect(isNaddr('npub123')).toBe(false);
    expect(isNaddr('note123')).toBe(false);
  });
});