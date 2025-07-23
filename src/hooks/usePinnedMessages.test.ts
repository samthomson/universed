import { describe, it, expect } from 'vitest';
import { getMessageChannelId } from './usePinnedMessages';
import type { NostrEvent } from '@nostrify/nostrify';

describe('usePinnedMessages', () => {
  describe('getMessageChannelId', () => {
    it('should extract channel ID from message tags', () => {
      const message: NostrEvent = {
        id: 'test-id',
        pubkey: 'test-pubkey',
        created_at: 1234567890,
        kind: 9411,
        content: 'Test message',
        tags: [
          ['t', 'general'],
          ['a', '34550:pubkey:community-id']
        ],
        sig: 'test-sig'
      };

      const channelId = getMessageChannelId(message);
      expect(channelId).toBe('general');
    });

    it('should return null if no channel tag is found', () => {
      const message: NostrEvent = {
        id: 'test-id',
        pubkey: 'test-pubkey',
        created_at: 1234567890,
        kind: 9411,
        content: 'Test message',
        tags: [
          ['a', '34550:pubkey:community-id']
        ],
        sig: 'test-sig'
      };

      const channelId = getMessageChannelId(message);
      expect(channelId).toBeNull();
    });

    it('should return the first channel tag if multiple exist', () => {
      const message: NostrEvent = {
        id: 'test-id',
        pubkey: 'test-pubkey',
        created_at: 1234567890,
        kind: 9411,
        content: 'Test message',
        tags: [
          ['t', 'general'],
          ['t', 'random'],
          ['a', '34550:pubkey:community-id']
        ],
        sig: 'test-sig'
      };

      const channelId = getMessageChannelId(message);
      expect(channelId).toBe('general');
    });
  });
});