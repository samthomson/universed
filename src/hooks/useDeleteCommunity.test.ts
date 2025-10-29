import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useDeleteCommunity } from './useDeleteCommunity';
import { useDataManager, type CommunityData, type MessagingDomain, type CommunitiesDomain } from '@/components/DataManagerProvider';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';

// Mock dependencies
vi.mock('@/components/DataManagerProvider');
vi.mock('@/hooks/useNostrPublish');
vi.mock('@/hooks/useToast');

const mockCreateEvent = vi.fn();
const mockDeleteCommunityImmediately = vi.fn();
const mockToast = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockCommunity: CommunityData = {
  id: 'test-community',
  fullAddressableId: '34550:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:test-community',
  pubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  info: {
    name: 'Test Community',
    description: 'A test community',
    image: 'https://example.com/image.jpg',
    moderators: [],
    relays: [],
  },
  definitionEvent: {
    id: '0000000000000000000000000000000000000000000000000000000000000001',
    pubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    created_at: 1234567890,
    kind: 34550,
    tags: [['d', 'test-community'], ['name', 'Test Community']],
    content: '',
    sig: '0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  },
  channels: new Map(),
  approvedMembers: { members: [], event: null },
  pendingMembers: { members: [], event: null },
  declinedMembers: { members: [], event: null },
  bannedMembers: { members: [], event: null },
  membershipStatus: 'owner',
  lastActivity: Date.now(),
};

// Create a wrapper with QueryClient for React Query hooks
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }
  
  return Wrapper;
}

describe('useDeleteCommunity', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock DataManager
    const communityMap = new Map<string, CommunityData>();
    communityMap.set('34550:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:test-community', mockCommunity);

    vi.mocked(useDataManager).mockReturnValue({
      messaging: {
        messages: new Map(),
        isLoading: false,
        loadingPhase: 'ready',
        isDoingInitialLoad: false,
        lastSync: { nip4: null, nip17: null },
        subscriptions: { nip4: false, nip17: false },
        conversations: [],
        getDebugInfo: vi.fn(),
        writeAllMessagesToStore: vi.fn(),
        resetMessageDataAndCache: vi.fn(),
        handleNIP17SettingChange: vi.fn(),
        sendMessage: vi.fn(),
        isNIP17Enabled: false,
        isDebugging: false,
        scanProgress: { nip4: null, nip17: null },
        clearCacheAndRefetch: vi.fn(),
      } as MessagingDomain,
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
        getDebugInfo: vi.fn(),
        getSortedChannels: vi.fn(),
        getFolders: vi.fn(),
        getChannelsWithoutFolder: vi.fn(),
        addOptimisticMessage: vi.fn(),
        addOptimisticChannel: vi.fn(),
        deleteChannelImmediately: vi.fn(),
        deleteCommunityImmediately: mockDeleteCommunityImmediately,
        loadOlderMessages: vi.fn(),
        resetCommunitiesDataAndCache: vi.fn(),
        useDataManagerPinnedMessages: vi.fn(),
        approveMember: vi.fn(),
        declineMember: vi.fn(),
        banMember: vi.fn(),
        addOptimisticCommunity: vi.fn(),
        refreshCommunities: vi.fn(),
        addProspectiveCommunity: vi.fn(),
        clearCacheAndRefetch: vi.fn(),
      } as CommunitiesDomain,
    });

    vi.mocked(useNostrPublish).mockReturnValue({
      mutateAsync: mockCreateEvent,
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      isIdle: true,
      data: undefined,
      error: null,
      variables: undefined,
      status: 'idle',
      failureCount: 0,
      failureReason: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useNostrPublish>);

    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
      dismiss: vi.fn(),
      toasts: [],
    });
  });

  it('creates kind 5 deletion event with addressable coordinate', async () => {
    mockCreateEvent.mockResolvedValue({});

    const { result } = renderHook(() => useDeleteCommunity('34550:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:test-community'), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync();

    expect(mockCreateEvent).toHaveBeenCalledWith({
      kind: 5,
      content: 'Community deleted by owner',
      tags: [
        ['a', '34550:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:test-community'],
        ['k', '34550'],
      ],
    });
  });

  it('removes community from local state after deletion', async () => {
    mockCreateEvent.mockResolvedValue({});

    const { result } = renderHook(() => useDeleteCommunity('34550:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:test-community'), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync();

    expect(mockDeleteCommunityImmediately).toHaveBeenCalledWith('34550:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:test-community');
  });

  it('shows success toast and navigates after successful deletion', async () => {
    mockCreateEvent.mockResolvedValue({});

    const { result } = renderHook(() => useDeleteCommunity('34550:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:test-community'), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync();

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Community has been deleted.',
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith('/space');
  });

  it('shows error toast when deletion fails', async () => {
    mockCreateEvent.mockRejectedValue(new Error('Failed to delete'));

    const { result } = renderHook(() => useDeleteCommunity('34550:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:test-community'), {
      wrapper: createWrapper(),
    });

    try {
      await result.current.mutateAsync();
    } catch {
      // Expected to throw
    }

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to delete community. Please try again.',
        variant: 'destructive',
      });
    });

    // Should NOT navigate on error
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows cancellation toast when user cancels signer request', async () => {
    mockCreateEvent.mockRejectedValue(new Error('User cancelled the request'));

    const { result } = renderHook(() => useDeleteCommunity('34550:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:test-community'), {
      wrapper: createWrapper(),
    });

    try {
      await result.current.mutateAsync();
    } catch {
      // Expected to throw
    }

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Deletion Cancelled',
        description: 'You cancelled the deletion request. The community was not deleted.',
        variant: 'destructive',
      });
    });
  });

  it('throws error when community is not found', async () => {
    // Mock empty community map
    vi.mocked(useDataManager).mockReturnValue({
      messaging: {
        messages: new Map(),
        isLoading: false,
        loadingPhase: 'ready',
        isDoingInitialLoad: false,
        lastSync: { nip4: null, nip17: null },
        subscriptions: { nip4: false, nip17: false },
        conversations: [],
        getDebugInfo: vi.fn(),
        writeAllMessagesToStore: vi.fn(),
        resetMessageDataAndCache: vi.fn(),
        handleNIP17SettingChange: vi.fn(),
        sendMessage: vi.fn(),
        isNIP17Enabled: false,
        isDebugging: false,
        scanProgress: { nip4: null, nip17: null },
        clearCacheAndRefetch: vi.fn(),
      } as MessagingDomain,
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
        subscriptions: { messages: false, management: false },
        getDebugInfo: vi.fn(),
        getSortedChannels: vi.fn(),
        getFolders: vi.fn(),
        getChannelsWithoutFolder: vi.fn(),
        addOptimisticMessage: vi.fn(),
        addOptimisticChannel: vi.fn(),
        deleteChannelImmediately: vi.fn(),
        deleteCommunityImmediately: mockDeleteCommunityImmediately,
        loadOlderMessages: vi.fn(),
        resetCommunitiesDataAndCache: vi.fn(),
        useDataManagerPinnedMessages: vi.fn(),
        approveMember: vi.fn(),
        declineMember: vi.fn(),
        banMember: vi.fn(),
        addOptimisticCommunity: vi.fn(),
        refreshCommunities: vi.fn(),
        addProspectiveCommunity: vi.fn(),
        clearCacheAndRefetch: vi.fn(),
      } as CommunitiesDomain,
    });

    const { result } = renderHook(() => useDeleteCommunity('non-existent-community'), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync()).rejects.toThrow('Community not found');

    // Should NOT call createEvent or deleteCommunityImmediately
    expect(mockCreateEvent).not.toHaveBeenCalled();
    expect(mockDeleteCommunityImmediately).not.toHaveBeenCalled();
  });
});

