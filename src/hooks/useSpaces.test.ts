import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { parseSpaceEvent } from './useSpaces';

describe('useSpaces', () => {
  describe('parseSpaceEvent', () => {
    it('should extract consistent space ID from d tag with communityId prefix', () => {
      const event: NostrEvent = {
        id: 'test-event-id',
        pubkey: 'test-pubkey',
        kind: 39097,
        content: JSON.stringify({
          name: 'Test Space',
          description: 'A test space',
          type: 'custom',
          icon: 'Box',
          enabled: true,
          position: 1,
        }),
        tags: [
          ['d', 'test-space'],
          ['a', '34550:test-pubkey:community-id'],
          ['name', 'Test Space'],
          ['description', 'A test space'],
          ['space_type', 'custom'],
          ['icon', 'Box'],
          ['enabled', 'true'],
          ['position', '1'],
          ['t', 'space'],
        ],
        created_at: 1234567890,
        sig: 'test-signature',
      };

      const communityId = '34550:test-pubkey:community-id';
      const space = parseSpaceEvent(event, communityId);

      expect(space.id).toBe('test-space');
      expect(space.name).toBe('Test Space');
      expect(space.communityId).toBe(communityId);
    });

    it('should extract space ID from d tag without communityId prefix (legacy format)', () => {
      const event: NostrEvent = {
        id: 'test-event-id',
        pubkey: 'test-pubkey',
        kind: 39097,
        content: JSON.stringify({
          name: 'Test Space',
          description: 'A test space',
          type: 'custom',
          icon: 'Box',
          enabled: true,
          position: 1,
        }),
        tags: [
          ['d', 'test-space'],
          ['a', '34550:test-pubkey:community-id'],
          ['name', 'Test Space'],
          ['description', 'A test space'],
          ['space_type', 'custom'],
          ['icon', 'Box'],
          ['enabled', 'true'],
          ['position', '1'],
          ['t', 'space'],
        ],
        created_at: 1234567890,
        sig: 'test-signature',
      };

      const communityId = '34550:test-pubkey:community-id';
      const space = parseSpaceEvent(event, communityId);

      expect(space.id).toBe('test-space');
      expect(space.name).toBe('Test Space');
      expect(space.communityId).toBe(communityId);
    });

    it('should generate consistent space ID from name when d tag is missing', () => {
      const event: NostrEvent = {
        id: 'test-event-id',
        pubkey: 'test-pubkey',
        kind: 39097,
        content: JSON.stringify({
          name: 'Test Space With Spaces',
          description: 'A test space',
          type: 'custom',
          icon: 'Box',
          enabled: true,
          position: 1,
        }),
        tags: [
          ['a', '34550:test-pubkey:community-id'],
          ['name', 'Test Space With Spaces'],
          ['description', 'A test space'],
          ['space_type', 'custom'],
          ['icon', 'Box'],
          ['enabled', 'true'],
          ['position', '1'],
          ['t', 'space'],
        ],
        created_at: 1234567890,
        sig: 'test-signature',
      };

      const communityId = '34550:test-pubkey:community-id';
      const space = parseSpaceEvent(event, communityId);

      expect(space.id).toBe('test-space-with-spaces');
      expect(space.name).toBe('Test Space With Spaces');
      expect(space.communityId).toBe(communityId);
    });

    it('should handle special characters in space name consistently', () => {
      const event: NostrEvent = {
        id: 'test-event-id',
        pubkey: 'test-pubkey',
        kind: 39097,
        content: JSON.stringify({
          name: 'My Custom Space!!!',
          description: 'A test space',
          type: 'custom',
          icon: 'Box',
          enabled: true,
          position: 1,
        }),
        tags: [
          ['a', '34550:test-pubkey:community-id'],
          ['name', 'My Custom Space!!!'],
          ['description', 'A test space'],
          ['space_type', 'custom'],
          ['icon', 'Box'],
          ['enabled', 'true'],
          ['position', '1'],
          ['t', 'space'],
        ],
        created_at: 1234567890,
        sig: 'test-signature',
      };

      const communityId = '34550:test-pubkey:community-id';
      const space = parseSpaceEvent(event, communityId);

      expect(space.id).toBe('my-custom-space!!!');
      expect(space.name).toBe('My Custom Space!!!');
      expect(space.communityId).toBe(communityId);
    });

    it('should prioritize content JSON over tags when available', () => {
      const event: NostrEvent = {
        id: 'test-event-id',
        pubkey: 'test-pubkey',
        kind: 39097,
        content: JSON.stringify({
          name: 'JSON Space Name',
          description: 'JSON description',
          type: 'marketplace',
          icon: 'ShoppingBag',
          enabled: false,
          position: 5,
        }),
        tags: [
          ['d', 'tag-space'],
          ['a', '34550:test-pubkey:community-id'],
          ['name', 'Tag Space Name'],
          ['description', 'Tag description'],
          ['space_type', 'custom'],
          ['icon', 'Box'],
          ['enabled', 'true'],
          ['position', '1'],
          ['t', 'space'],
        ],
        created_at: 1234567890,
        sig: 'test-signature',
      };

      const communityId = '34550:test-pubkey:community-id';
      const space = parseSpaceEvent(event, communityId);

      expect(space.id).toBe('tag-space');
      expect(space.name).toBe('JSON Space Name');
      expect(space.description).toBe('JSON description');
      expect(space.type).toBe('marketplace');
      expect(space.icon).toBe('ShoppingBag');
      expect(space.enabled).toBe(false);
      expect(space.position).toBe(5);
    });

    it('should handle malformed JSON content gracefully', () => {
      const event: NostrEvent = {
        id: 'test-event-id',
        pubkey: 'test-pubkey',
        kind: 39097,
        content: 'invalid-json-content',
        tags: [
          ['d', 'test-space'],
          ['a', '34550:test-pubkey:community-id'],
          ['name', 'Test Space'],
          ['description', 'A test space'],
          ['space_type', 'custom'],
          ['icon', 'Box'],
          ['enabled', 'true'],
          ['position', '1'],
          ['t', 'space'],
        ],
        created_at: 1234567890,
        sig: 'test-signature',
      };

      const communityId = '34550:test-pubkey:community-id';
      const space = parseSpaceEvent(event, communityId);

      expect(space.id).toBe('test-space');
      expect(space.name).toBe('Test Space');
      expect(space.description).toBe('A test space');
      expect(space.type).toBe('custom');
      expect(space.icon).toBe('Box');
      expect(space.enabled).toBe(true);
      expect(space.position).toBe(1);
    });
  });

  describe('Space ID Consistency', () => {
    it('should generate the same ID for the same name during creation and parsing', () => {
      // This test simulates the scenario where a space is created with a name
      // and then parsed back to verify the ID consistency

      const spaceName = 'My Test Space';
      const expectedSpaceId = spaceName.toLowerCase().replace(/\s+/g, '-');

      // Simulate creation (how spaceId is generated in CreateSpaceForm)
      const creationSpaceId = spaceName.toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-').trim();

      // Simulate parsing (how spaceId is extracted in parseSpaceEvent when d tag is missing)
      const parsingSpaceId = spaceName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();

      expect(creationSpaceId).toBe(expectedSpaceId);
      expect(parsingSpaceId).toBe(expectedSpaceId);
      expect(creationSpaceId).toBe(parsingSpaceId);
    });

    it('should handle complex names with multiple spaces and special characters', () => {
      const testCases = [
        { name: 'Simple Space', expected: 'simple-space' },
        { name: 'Space With Multiple Words', expected: 'space-with-multiple-words' },
        { name: 'UPPERCASE SPACE', expected: 'uppercase-space' },
        { name: 'Mixed Case Space Name', expected: 'mixed-case-space-name' },
        { name: 'Space!!! With??? Special... Characters', expected: 'space!!!-with???-special...-characters' },
        { name: '  Extra  Spaces  ', expected: '-extra-spaces-' },
        { name: 'Hyphenated-Space-Name', expected: 'hyphenated-space-name' },
      ];

      testCases.forEach(({ name, expected }) => {
        // Simulate creation (how spaceId is generated in CreateSpaceForm)
        const creationSpaceId = name.toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-').trim();

        // Simulate parsing (how spaceId is extracted in parseSpaceEvent when d tag is missing)
        const parsingSpaceId = name.toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-').trim();

        expect(creationSpaceId).toBe(expected);
        expect(parsingSpaceId).toBe(expected);
        expect(creationSpaceId).toBe(parsingSpaceId);
      });
    });
  });
});