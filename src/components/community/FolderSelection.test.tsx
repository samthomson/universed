import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { CreateChannelDialog } from './CreateChannelDialog';

// Mock the hooks
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: {
      pubkey: 'test-pubkey',
    },
  }),
}));

vi.mock('@/hooks/useCommunities', () => ({
  useCommunities: () => ({
    data: [{
      id: 'test-community',
      creator: 'test-pubkey',
      moderators: [],
    }],
  }),
}));

vi.mock('@/hooks/useUserMembership', () => ({
  useUserMembership: () => ({
    data: [{
      communityId: 'test-community',
      status: 'owner',
    }],
  }),
}));

vi.mock('@/hooks/useChannelFolders', () => ({
  useChannelFolders: () => ({
    data: [
      { id: 'folder1', name: 'Folder 1' },
      { id: 'folder2', name: 'Folder 2' },
    ],
  }),
}));

vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: vi.fn(),
  }),
}));

describe('Folder Selection', () => {
  it('should render without crashing when no initial folder is provided', () => {
    const { container } = render(
      <TestApp>
        <CreateChannelDialog
          communityId="test-community"
          trigger={<button>Create Channel</button>}
        />
      </TestApp>
    );

    // The component should render without errors
    expect(container).toBeDefined();
  });

  it('should render without crashing when initial folder is provided', () => {
    const { container } = render(
      <TestApp>
        <CreateChannelDialog
          communityId="test-community"
          folderId="folder1"
          trigger={<button>Create Channel</button>}
        />
      </TestApp>
    );

    // The component should render without errors
    expect(container).toBeDefined();
  });
});