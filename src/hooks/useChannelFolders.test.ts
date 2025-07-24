import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';

// Import the parseChannelFolderEvent function - we need to export it first
// For now, let's test the logic by creating a test event similar to the one provided

describe('Channel Folder ID Parsing', () => {
  it('should correctly extract folder ID from d tag with complex community ID', () => {
    // This simulates the event structure from the user's example
    const mockEvent: NostrEvent = {
      id: 'test-event-id',
      kind: 32603,
      pubkey: '932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d',
      created_at: 1753320003,
      content: '{"name":"Folder 3","description":"","position":4}',
      tags: [
        ['d', '34550:932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:and-other-stuff-mb3c9stb:folder-3'],
        ['a', '34550:932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:and-other-stuff-mb3c9stb'],
        ['name', 'Folder 3'],
        ['description', ''],
        ['position', '4'],
        ['t', 'channel-folder'],
        ['alt', 'Channel folder: Folder 3']
      ],
      sig: 'test-signature'
    };

    const communityId = '34550:932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:and-other-stuff-mb3c9stb';
    const dTag = mockEvent.tags.find(([name]) => name === 'd')?.[1] || '';
    
    // Test the folder ID extraction logic
    let folderId = dTag;
    if (dTag.startsWith(communityId + ':')) {
      folderId = dTag.substring(communityId.length + 1);
    } else {
      // Fallback: take the last part after splitting by ':'
      const parts = dTag.split(':');
      folderId = parts[parts.length - 1] || 'fallback';
    }

    expect(folderId).toBe('folder-3');
    expect(folderId).not.toBe('932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d'); // Should not be the pubkey
  });

  it('should handle fallback case when d tag does not start with community ID', () => {
    const dTag = 'some:other:format:my-folder-id';
    const communityId = 'different-community-id';
    
    let folderId = dTag;
    if (dTag.startsWith(communityId + ':')) {
      folderId = dTag.substring(communityId.length + 1);
    } else {
      // Fallback: take the last part after splitting by ':'
      const parts = dTag.split(':');
      folderId = parts[parts.length - 1] || 'fallback';
    }

    expect(folderId).toBe('my-folder-id');
  });

  it('should handle edge case with no colons in d tag', () => {
    const dTag = 'simple-folder-id';
    const communityId = 'some-community-id';
    
    let folderId = dTag;
    if (dTag.startsWith(communityId + ':')) {
      folderId = dTag.substring(communityId.length + 1);
    } else {
      // Fallback: take the last part after splitting by ':'
      const parts = dTag.split(':');
      folderId = parts[parts.length - 1] || 'fallback';
    }

    expect(folderId).toBe('simple-folder-id');
  });
});