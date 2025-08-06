import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { ChannelOrganizer } from './ChannelOrganizer';

// Import the mocked hooks
import { useChannels as _useChannels } from '@/hooks/useChannels';
import { useChannelFolders as _useChannelFolders } from '@/hooks/useChannelFolders';
import { useVoiceChannel as _useVoiceChannel } from '@/hooks/useVoiceChannel';

// Mock the hooks to control loading states
vi.mock('@/hooks/useChannels', () => ({
  useChannels: vi.fn(() => ({
    data: undefined, // No data to trigger loading state
    isLoading: true,
  })),
}));

vi.mock('@/hooks/useChannelFolders', () => ({
  useChannelFolders: vi.fn(() => ({
    data: undefined, // No data to trigger loading state
    isLoading: true,
  })),
  useCreateChannelFolder: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
  useUpdateChannelFolder: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
  useDeleteChannelFolder: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
}));

vi.mock('@/hooks/useCommunityRoles', () => ({
  useCanModerate: vi.fn(() => ({
    canModerate: false,
  })),
}));

vi.mock('@/hooks/useVoiceChannel', () => ({
  useVoiceChannel: vi.fn(() => ({
    voiceState: { members: [] },
    isConnected: false,
    connectionStatus: 'disconnected',
  })),
}));

describe('ChannelOrganizer', () => {
  it('shows loading skeleton when data is loading', () => {
    render(
      <TestApp>
        <ChannelOrganizer
          communityId="test-community"
          selectedChannel={null}
          onSelectChannel={() => {}}
          onChannelSettings={() => {}}
          canModerate={false}
          onChannelCreated={() => {}}
        />
      </TestApp>
    );

    // Check that skeleton elements are present by looking for elements with skeleton class
    const skeletons = document.querySelectorAll('.animate-pulse');
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

    render(
      <TestApp>
        <ChannelOrganizer
          communityId="test-community"
          selectedChannel={null}
          onSelectChannel={() => {}}
          onChannelSettings={() => {}}
          canModerate={false}
          onChannelCreated={() => {}}
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

    render(
      <TestApp>
        <ChannelOrganizer
          communityId="test-community"
          selectedChannel={null}
          onSelectChannel={() => {}}
          onChannelSettings={() => {}}
          canModerate={false}
          onChannelCreated={() => {}}
        />
      </TestApp>
    );

    // Check that the indicator dot is gray (no users connected)
    const grayIndicator = document.querySelector('.bg-gray-500');
    expect(grayIndicator).toBeInTheDocument();
  });
});