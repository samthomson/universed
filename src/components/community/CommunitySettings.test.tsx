import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { CommunitySettings } from './CommunitySettings';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCommunities } from '@/hooks/useCommunities';
import { useCommunityMembers } from '@/hooks/useCommunityMembers';
import { useJoinRequests } from '@/hooks/useJoinRequests';
import { useModerationLogs, useModerationStats } from '@/hooks/useModerationLogs';
import { useReports } from '@/hooks/useReporting';
import { useCommunitySettings, useUpdateCommunitySettings } from '@/hooks/useCommunitySettings';
import { useManageMembers } from '@/hooks/useManageMembers';
import { useUploadFile } from '@/hooks/useUploadFile';
import { useToast } from '@/hooks/useToast';
import { useIsMobile } from '@/hooks/useIsMobile';

// Mock the hooks
vi.mock('@/hooks/useNostrPublish');
vi.mock('@/hooks/useCurrentUser');
vi.mock('@/hooks/useCommunities');
vi.mock('@/hooks/useCommunityMembers');
vi.mock('@/hooks/useJoinRequests');
vi.mock('@/hooks/useModerationLogs');
vi.mock('@/hooks/useReporting');
vi.mock('@/hooks/useCommunitySettings');
vi.mock('@/hooks/useManageMembers');
vi.mock('@/hooks/useUploadFile');
vi.mock('@/hooks/useToast');
vi.mock('@/hooks/useIsMobile');

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

const mockCommunity = {
  id: '34550:test-pubkey:test-community',
  name: 'Test Community',
  description: 'A test community',
  image: 'https://example.com/image.jpg',
  creator: 'test-pubkey',
  moderators: ['test-pubkey'],
  event: {
    id: 'test-event-id',
    pubkey: 'test-pubkey',
    created_at: 1234567890,
    kind: 34550,
    tags: [['d', 'test-community'], ['name', 'Test Community']],
    content: '',
    sig: 'test-sig',
  },
  relays: [],
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

    vi.mocked(useCommunities).mockReturnValue({
      data: [mockCommunity],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useCommunities>);

    vi.mocked(useCommunityMembers).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useCommunityMembers>);

    vi.mocked(useJoinRequests).mockReturnValue({
      data: [],
      isRefetching: false,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useJoinRequests>);

    vi.mocked(useModerationLogs).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useModerationLogs>);

    vi.mocked(useModerationStats).mockReturnValue({
      totalActions: 0,
      actionsByType: {},
    } as unknown as ReturnType<typeof useModerationStats>);

    vi.mocked(useReports).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useReports>);

    vi.mocked(useCommunitySettings).mockReturnValue({
      data: { requireApproval: true },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useCommunitySettings>);

    vi.mocked(useUpdateCommunitySettings).mockReturnValue({
      mutateAsync: vi.fn(),
    } as unknown as ReturnType<typeof useUpdateCommunitySettings>);

    vi.mocked(useManageMembers).mockReturnValue({
      addMember: vi.fn(),
      declineMember: vi.fn(),
      isAddingMember: false,
      isRemovingMember: false,
      isBanningMember: false,
    } as unknown as ReturnType<typeof useManageMembers>);

    vi.mocked(useUploadFile).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUploadFile>);

    vi.mocked(useToast).mockReturnValue({
      toast: vi.fn(),
      dismiss: vi.fn(),
      toasts: [],
    } as unknown as ReturnType<typeof useToast>);

    vi.mocked(useIsMobile).mockReturnValue(false as unknown as ReturnType<typeof useIsMobile>);
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

    // Click confirm delete button
    const confirmButton = screen.getByText('Delete Community', { selector: '.bg-red-600' });
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

    // Click confirm delete button
    const confirmButton = screen.getByText('Delete Community', { selector: '.bg-red-600' });
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