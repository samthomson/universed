import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { CommunitySettings } from './CommunitySettings';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useModerationLogs } from '@/hooks/useModerationLogs';
import { useReports } from '@/hooks/useReporting';
import { useUploadFile } from '@/hooks/useUploadFile';
import { useToast } from '@/hooks/useToast';
import { useDataManager, useDataManagerCommunityMembers, useDataManagerJoinRequests, type CommunityData } from '@/components/DataManagerProvider';

// Mock the hooks
vi.mock('@/hooks/useNostrPublish');
vi.mock('@/hooks/useCurrentUser');
vi.mock('@/hooks/useModerationLogs');
vi.mock('@/hooks/useReporting');
vi.mock('@/hooks/useUploadFile');
vi.mock('@/hooks/useToast');

// Mock DataManager hooks
vi.mock('@/components/DataManagerProvider', async () => {
  const actual = await vi.importActual('@/components/DataManagerProvider');
  return {
    ...actual,
    useDataManager: vi.fn(),
    useDataManagerCommunityMembers: vi.fn(),
    useDataManagerJoinRequests: vi.fn(),
  };
});

const mockCreateEvent = vi.fn();
const mockUser = {
  pubkey: 'test-pubkey',
  signer: {
    nip04: {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
    },
    nip44: {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
    },
    signEvent: vi.fn(),
  },
};

const mockCommunity: CommunityData = {
  id: 'test-community',
  fullAddressableId: '34550:test-pubkey:test-community',
  pubkey: 'test-pubkey',
  info: {
    name: 'Test Community',
    description: 'A test community',
    image: 'https://example.com/image.jpg',
    moderators: ['test-pubkey'],
    relays: [],
  },
  definitionEvent: {
    id: 'test-event-id',
    pubkey: 'test-pubkey',
    created_at: 1234567890,
    kind: 34550,
    tags: [['d', 'test-community'], ['name', 'Test Community']],
    content: '',
    sig: 'test-sig',
  },
  channels: new Map(),
  approvedMembers: { members: [], event: null },
  pendingMembers: { members: [], event: null },
  declinedMembers: { members: [], event: null },
  bannedMembers: { members: [], event: null },
  membershipStatus: 'owner',
  lastActivity: Date.now(),
};

describe('CommunitySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock implementations
    vi.mocked(useNostrPublish).mockReturnValue({
      mutateAsync: mockCreateEvent,
    } as unknown as ReturnType<typeof useNostrPublish>);

    vi.mocked(useCurrentUser).mockReturnValue({
      user: mockUser,
      users: [],
    } as unknown as ReturnType<typeof useCurrentUser>);

    // Mock DataManager - provide the community data
    const communityMap = new Map<string, CommunityData>();
    communityMap.set('34550:test-pubkey:test-community', mockCommunity);

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
        getFolders: vi.fn(() => []),
        getChannelsWithoutFolder: vi.fn(() => ({ text: [], voice: [] })),
        getSortedChannels: vi.fn(() => []),
        getDebugInfo: vi.fn(() => ({ communityCount: 1, channelCount: 0, messageCount: 0, replyCount: 0, reactionCount: 0, pinnedCount: 0 })),
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
    });

    // Mock DataManager member hooks
    vi.mocked(useDataManagerCommunityMembers).mockReturnValue({
      data: [],
      isLoading: false,
    });

    vi.mocked(useDataManagerJoinRequests).mockReturnValue({
      data: [],
      isLoading: false,
    });

    vi.mocked(useModerationLogs).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useModerationLogs>);

    vi.mocked(useReports).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useReports>);

    vi.mocked(useUploadFile).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUploadFile>);

    vi.mocked(useToast).mockReturnValue({
      toast: vi.fn(),
      dismiss: vi.fn(),
      toasts: [],
    } as unknown as ReturnType<typeof useToast>);
  });

  it('renders community settings dialog', () => {
    render(
      <TestApp>
        <CommunitySettings
          communityId="34550:test-pubkey:test-community"
          open={true}
          onOpenChange={vi.fn()}
        />
      </TestApp>
    );

    expect(screen.getByText('Test Community Settings')).toBeInTheDocument();
    expect(screen.getByText('Community Information')).toBeInTheDocument();
    expect(screen.getByText('Danger Zone')).toBeInTheDocument();
  });

  it('shows delete community button for admin', () => {
    render(
      <TestApp>
        <CommunitySettings
          communityId="34550:test-pubkey:test-community"
          open={true}
          onOpenChange={vi.fn()}
        />
      </TestApp>
    );

    expect(screen.getByText('Delete Community')).toBeInTheDocument();
  });

  it('opens delete confirmation dialog when delete button is clicked', async () => {
    render(
      <TestApp>
        <CommunitySettings
          communityId="34550:test-pubkey:test-community"
          open={true}
          onOpenChange={vi.fn()}
        />
      </TestApp>
    );

    const deleteButton = screen.getByText('Delete Community');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Are you absolutely sure?')).toBeInTheDocument();
      expect(screen.getByText('This action cannot be undone. This will permanently delete the community and remove all associated data.')).toBeInTheDocument();
    });
  });

  it('creates kind 5 deletion event when delete is confirmed', async () => {
    const mockOnOpenChange = vi.fn();
    mockCreateEvent.mockResolvedValue({});

    render(
      <TestApp>
        <CommunitySettings
          communityId="34550:test-pubkey:test-community"
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      </TestApp>
    );

    // Click delete button to open confirmation dialog
    const deleteButton = screen.getByText('Delete Community');
    fireEvent.click(deleteButton);

    // Wait for confirmation dialog to appear
    await waitFor(() => {
      expect(screen.getByText('Are you absolutely sure?')).toBeInTheDocument();
    });

    // Click confirm delete button (the one inside the AlertDialog)
    const confirmButton = screen.getByRole('button', { name: 'Delete Community' });
    fireEvent.click(confirmButton);

    // Verify that createEvent was called with correct parameters
    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalledWith({
        kind: 5,
        content: 'Community deleted by owner',
        tags: [
          ['e', 'test-event-id'],
          ['k', '34550'],
        ],
      });
    });

    // Verify that the dialog was closed
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows error toast when deletion fails', async () => {
    const mockToast = vi.fn();
    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
      dismiss: vi.fn(),
      toasts: [],
    } as unknown as ReturnType<typeof useToast>);

    mockCreateEvent.mockRejectedValue(new Error('Failed to delete'));

    render(
      <TestApp>
        <CommunitySettings
          communityId="34550:test-pubkey:test-community"
          open={true}
          onOpenChange={vi.fn()}
        />
      </TestApp>
    );

    // Click delete button to open confirmation dialog
    const deleteButton = screen.getByText('Delete Community');
    fireEvent.click(deleteButton);

    // Wait for confirmation dialog to appear
    await waitFor(() => {
      expect(screen.getByText('Are you absolutely sure?')).toBeInTheDocument();
    });

    // Click confirm delete button (the one inside the AlertDialog)
    const confirmButton = screen.getByRole('button', { name: 'Delete Community' });
    fireEvent.click(confirmButton);

    // Verify that error toast was shown
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to delete community',
        variant: 'destructive',
      });
    });
  });

  it('does not show delete button for non-admin users', () => {
    // Mock a non-admin user
    vi.mocked(useCurrentUser).mockReturnValue({
      user: {
        ...mockUser,
        pubkey: 'different-pubkey',
      },
      users: [],
    } as unknown as ReturnType<typeof useCurrentUser>);

    render(
      <TestApp>
        <CommunitySettings
          communityId="34550:test-pubkey:test-community"
          open={true}
          onOpenChange={vi.fn()}
        />
      </TestApp>
    );

    expect(screen.queryByText('Delete Community')).not.toBeInTheDocument();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });
});