import { describe, it, expect, vi, afterEach } from 'vitest';
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

// Mock DataManagerProvider
vi.mock('@/components/DataManagerProvider', async () => {
  const actual = await vi.importActual('@/components/DataManagerProvider');
  return {
    ...actual,
    useDataManager: vi.fn(() => ({
      messaging: {
        messages: new Map(),
        isLoading: false,
        loadingPhase: 'ready',
        isDoingInitialLoad: false,
        lastSync: { nip4: null, nip17: null },
        subscriptions: { nip4: false, nip17: false },
        conversations: [],
        getDebugInfo: vi.fn(() => ({
          messageCount: 0,
          nip4Count: 0,
          nip17Count: 0,
          nip4Sync: null,
          nip17Sync: null,
          nip17Enabled: false,
        })),
        writeAllMessagesToStore: vi.fn(),
        resetMessageDataAndCache: vi.fn(),
        handleNIP17SettingChange: vi.fn(),
        sendMessage: vi.fn(),
        isNIP17Enabled: false,
        isDebugging: false,
        scanProgress: { nip4: null, nip17: null },
      },
      communities: {
        communities: new Map(),
        isLoading: false,
        loadingPhase: 'ready',
        loadTime: null,
        loadBreakdown: null,
        isLoadingCommunities: false,
        isLoadingChannels: false,
        isLoadingMessages: false,
        hasBasicCommunitiesData: true,
        getFolders: vi.fn(() => []),
        getChannelsWithoutFolder: vi.fn(() => ({ text: [], voice: [] })),
        getSortedChannels: vi.fn(() => []),
        getDebugInfo: vi.fn(() => ({ communityCount: 0, channelCount: 0, messageCount: 0, replyCount: 0, reactionCount: 0, pinnedCount: 0 })),
        addOptimisticMessage: vi.fn(() => null),
        addOptimisticChannel: vi.fn(),
        deleteChannelImmediately: vi.fn(),
        loadOlderMessages: vi.fn(),
        resetCommunitiesDataAndCache: vi.fn(),
        useDataManagerPinnedMessages: vi.fn(() => []),
        approveMember: vi.fn(),
        declineMember: vi.fn(),
        banMember: vi.fn(),
      },
    })),
  };
});

describe('Folder Selection', () => {
  // Clean up after each test
  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });
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