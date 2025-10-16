import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { CommunityChannelList } from './CommunityChannelList';

// Import the mocked hooks
import { useVoiceChannel as _useVoiceChannel } from '@/hooks/useVoiceChannel';
import { useDataManager as _useDataManager, type DisplayChannel, type CommunityData } from '@/components/DataManagerProvider';

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
        isLoading: true,
        loadingPhase: 'initial',
        loadTime: null,
        loadBreakdown: null,
        isLoadingCommunities: false,
        isLoadingChannels: true,
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
    })),
  };
});

vi.mock('@/hooks/useVoiceChannel', () => ({
  useVoiceChannel: vi.fn(() => ({
    voiceState: { members: [] },
    isConnected: false,
    connectionStatus: 'disconnected',
  })),
}));

describe('CommunityChannelList', () => {
  it('shows loading skeleton when data is loading', () => {
    render(
      <TestApp>
        <CommunityChannelList
          communityId="test-community"
          selectedChannel={null}
          onSelectChannel={() => { }}
          onChannelSettings={() => { }}
          canModerate={false}
          onChannelCreated={() => { }}
        />
      </TestApp>
    );

    // Check that skeleton elements are present by looking for elements with skeleton data-testid
    const skeletons = document.querySelectorAll('[data-testid="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('displays voice channel status correctly', () => {
    // Mock voice channel with users connected
    vi.mocked(_useVoiceChannel).mockReturnValue({
      voiceState: {
        channelId: 'voice-channel-1',
        members: [
          { pubkey: 'user1', muted: false, deafened: false, speaking: false },
          { pubkey: 'user2', muted: true, deafened: false, speaking: false },
        ],
        lastUpdated: Date.now(),
        newMembers: [],
        leftMembers: [],
      },
      isConnected: true,
      connectionStatus: 'connected',
      isMuted: false,
      isDeafened: false,
      isSpeaking: false,
      actualConnectionCount: 0,
      joinVoiceChannel: vi.fn(),
      leaveVoiceChannel: vi.fn(),
      toggleMute: vi.fn(),
      toggleDeafen: vi.fn(),
      isJoining: false,
      isLeaving: false,
    });

    // Mock DataManager to include a voice channel
    const voiceChannel: DisplayChannel = {
      id: 'voice-channel-1',
      name: 'Voice Channel',
      type: 'voice',
      communityId: 'test-community',
      creator: 'test-user',
      position: 0,
      isRestricted: false,
      hasAccess: true,
      parsedPermissions: {
        readPermissions: 'everyone',
        writePermissions: 'everyone',
      },
      event: {
        id: 'test-event',
        pubkey: 'test-user',
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: '',
        sig: 'test-sig',
      },
    };

    vi.mocked(_useDataManager).mockReturnValue({
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
        communities: new Map<string, CommunityData>(),
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
        getChannelsWithoutFolder: vi.fn(() => ({
          text: [],
          voice: [voiceChannel],
        })),
        getSortedChannels: vi.fn(() => []),
        getDebugInfo: vi.fn(() => ({ communityCount: 0, channelCount: 0, messageCount: 0, replyCount: 0, reactionCount: 0, pinnedCount: 0 })),
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

    render(
      <TestApp>
        <CommunityChannelList
          communityId="test-community"
          selectedChannel={null}
          onSelectChannel={() => { }}
          onChannelSettings={() => { }}
          canModerate={false}
          onChannelCreated={() => { }}
        />
      </TestApp>
    );

    // Check that the indicator dot is green (has users connected)
    const greenIndicator = document.querySelector('.bg-green-500');
    expect(greenIndicator).toBeInTheDocument();
  });

  it('shows gray indicator when no users are connected', () => {
    // Mock voice channel with no users connected
    vi.mocked(_useVoiceChannel).mockReturnValue({
      voiceState: {
        channelId: 'voice-channel-1',
        members: [],
        lastUpdated: Date.now(),
        newMembers: [],
        leftMembers: [],
      },
      isConnected: false,
      connectionStatus: 'disconnected',
      isMuted: false,
      isDeafened: false,
      isSpeaking: false,
      actualConnectionCount: 0,
      joinVoiceChannel: vi.fn(),
      leaveVoiceChannel: vi.fn(),
      toggleMute: vi.fn(),
      toggleDeafen: vi.fn(),
      isJoining: false,
      isLeaving: false,
    });

    // Mock DataManager to include a voice channel with no users
    const voiceChannelEmpty: DisplayChannel = {
      id: 'voice-channel-1',
      name: 'Voice Channel',
      type: 'voice',
      communityId: 'test-community',
      creator: 'test-user',
      position: 0,
      isRestricted: false,
      hasAccess: true,
      parsedPermissions: {
        readPermissions: 'everyone',
        writePermissions: 'everyone',
      },
      event: {
        id: 'test-event',
        pubkey: 'test-user',
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: '',
        sig: 'test-sig',
      },
    };

    vi.mocked(_useDataManager).mockReturnValue({
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
        communities: new Map<string, CommunityData>(),
        isLoading: false,
        loadingPhase: 'ready',
        loadTime: null,
        loadBreakdown: null,
        isLoadingCommunities: false,
        isLoadingChannels: false,
        isLoadingMessages: false,
        hasBasicCommunitiesData: true,
        getFolders: vi.fn(() => []),
        getChannelsWithoutFolder: vi.fn(() => ({
          text: [],
          voice: [voiceChannelEmpty],
        })),
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

    render(
      <TestApp>
        <CommunityChannelList
          communityId="test-community"
          selectedChannel={null}
          onSelectChannel={() => { }}
          onChannelSettings={() => { }}
          canModerate={false}
          onChannelCreated={() => { }}
        />
      </TestApp>
    );

    // Check that the indicator dot is gray (no users connected)
    const grayIndicator = document.querySelector('.bg-muted-foreground');
    expect(grayIndicator).toBeInTheDocument();
  });
});