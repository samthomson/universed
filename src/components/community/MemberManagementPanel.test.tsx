import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { MemberManagementPanel } from './MemberManagementPanel';
import { useDataManager, useDataManagerCommunityMembers, type CommunityData } from '@/components/DataManagerProvider';

// Mock DataManager hooks
vi.mock('@/components/DataManagerProvider', async () => {
  const actual = await vi.importActual('@/components/DataManagerProvider');
  return {
    ...actual,
    useDataManager: vi.fn(),
    useDataManagerCommunityMembers: vi.fn(),
  };
});

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: vi.fn(() => ({
    data: {
      metadata: {
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
      },
    },
  })),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

describe('MemberManagementPanel', () => {
  it('renders member management tabs', () => {
    // Mock community data with declined and banned members
    const mockCommunity: CommunityData = {
      id: 'test-community',
      fullAddressableId: '34550:test-pubkey:test-community',
      pubkey: 'test-pubkey',
      info: {
        name: 'Test Community',
        description: 'A test community',
        moderators: [],
        relays: [],
      },
      definitionEvent: {
        id: 'test-event-id',
        pubkey: 'test-pubkey',
        created_at: 1234567890,
        kind: 34550,
        tags: [['d', 'test-community']],
        content: '',
        sig: 'test-sig',
      },
      channels: new Map(),
      approvedMembers: { members: ['pubkey1', 'pubkey2'], event: null },
      pendingMembers: { members: [], event: null },
      declinedMembers: { members: ['pubkey3'], event: null },
      bannedMembers: { members: ['pubkey4'], event: null },
      membershipStatus: 'owner',
      lastActivity: Date.now(),
    };

    const communityMap = new Map<string, CommunityData>();
    communityMap.set('test-community', mockCommunity);

    // Mock useDataManager to return the community with member lists
    vi.mocked(useDataManager).mockReturnValue({
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
        communities: communityMap,
        isLoading: false,
        loadingPhase: 'ready',
        loadTime: null,
        loadBreakdown: null,
        isLoadingCommunities: false,
        isLoadingChannels: false,
        isLoadingMessages: false,
        hasBasicCommunitiesData: true,
        subscriptions: { messages: false, management: false },
        getFolders: vi.fn(() => []),
        getChannelsWithoutFolder: vi.fn(() => ({ text: [], voice: [] })),
        getSortedChannels: vi.fn(() => []),
        getDebugInfo: vi.fn(() => ({ communityCount: 1, channelCount: 0, messageCount: 0, replyCount: 0, reactionCount: 0, pinnedCount: 0 })),
        addOptimisticMessage: vi.fn(() => null),
        addOptimisticChannel: vi.fn(),
        deleteChannelImmediately: vi.fn(),
        loadOlderMessages: vi.fn(),
        resetCommunitiesDataAndCache: vi.fn(),
        addOptimisticCommunity: vi.fn(),
        refreshCommunities: vi.fn(),
        addProspectiveCommunity: vi.fn(),
        useDataManagerPinnedMessages: vi.fn(() => []),
        approveMember: vi.fn(),
        declineMember: vi.fn(),
        banMember: vi.fn(),
      },
    });

    // Mock useDataManagerCommunityMembers to return members with role information
    vi.mocked(useDataManagerCommunityMembers).mockReturnValue({
      data: [
        { pubkey: 'pubkey1', role: 'member' as const, isOnline: false },
        { pubkey: 'pubkey2', role: 'member' as const, isOnline: false },
      ],
      isLoading: false,
    });

    render(
      <TestApp>
        <MemberManagementPanel communityId="test-community" />
      </TestApp>
    );

    expect(screen.getByText('Member Management')).toBeInTheDocument();
    expect(screen.getByText('Approved (2)')).toBeInTheDocument();
    expect(screen.getByText('Declined (1)')).toBeInTheDocument();
    expect(screen.getByText('Banned (1)')).toBeInTheDocument();
  });

  it('shows no community selected message when communityId is null', () => {
    // Mock empty return values for null communityId
    vi.mocked(useDataManager).mockReturnValue({
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
        addOptimisticCommunity: vi.fn(),
        refreshCommunities: vi.fn(),
        useDataManagerPinnedMessages: vi.fn(() => []),
        approveMember: vi.fn(),
        declineMember: vi.fn(),
        banMember: vi.fn(),
      },
    });

    vi.mocked(useDataManagerCommunityMembers).mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(
      <TestApp>
        <MemberManagementPanel communityId={null} />
      </TestApp>
    );

    expect(screen.getByText('No community selected')).toBeInTheDocument();
  });
});