import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CommunityMemberDisplay } from './CommunityMemberDisplay';
import { TestApp } from '@/test/TestApp';

// Mock the Avatar components
vi.mock('@/components/ui/avatar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/avatar')>();
  return {
    ...actual,
    ProfileAvatar: () => <div data-testid="mock-profile-avatar" />,
    Avatar: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
      <div className={className} data-testid="avatar">
        {children}
      </div>
    ),
    AvatarImage: ({ src, alt, className }: { src?: string; alt?: string; className?: string }) => (
      <img src={src} alt={alt} className={className} data-testid="avatar-image" />
    ),
    AvatarFallback: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
      <div className={className} data-testid="avatar-fallback">
        {children}
      </div>
    ),
  };
});

// Mock the Skeleton component
vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: { className?: string; [key: string]: unknown }) => (
    <div {...props} data-testid="skeleton" className="animate-pulse rounded-md bg-muted" />
  ),
}));

// Mock the useAuthor hook to return mock profile data
vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: vi.fn((pubkey: string) => ({
    data: {
      metadata: {
        name: `User ${pubkey.slice(-4)}`,
        picture: `https://example.com/avatar-${pubkey}.jpg`
      }
    },
    isLoading: false,
    isError: false
  }))
}));

describe('CommunityMemberDisplay', () => {
  const mockMembers = [
    { pubkey: 'user1', role: 'member' as const, isOnline: true },
    { pubkey: 'user2', role: 'member' as const, isOnline: false },
    { pubkey: 'user3', role: 'member' as const, isOnline: true },
    { pubkey: 'user4', role: 'member' as const, isOnline: false },
    { pubkey: 'user5', role: 'member' as const, isOnline: true },
  ];

  it('displays loading skeletons when isLoading is true', () => {
    render(
      <TestApp>
        <CommunityMemberDisplay
          members={[]}
          isLoading={true}
        />
      </TestApp>
    );

    // Check for loading skeletons
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons).toHaveLength(4); // 4 skeletons for loading state
  });

  it('displays member avatars when data is loaded', () => {
    render(
      <TestApp>
        <CommunityMemberDisplay
          members={mockMembers}
          isLoading={false}
        />
      </TestApp>
    );

    // Check that member count is displayed
    expect(screen.getByText('5 members')).toBeInTheDocument();

    // Check for ProfileAvatar components
    const profileAvatars = screen.getAllByTestId('mock-profile-avatar');
    expect(profileAvatars).toHaveLength(3); // First 3 members displayed
  });

  it('shows remaining count badge when there are more than 3 members', () => {
    render(
      <TestApp>
        <CommunityMemberDisplay
          members={mockMembers}
          isLoading={false}
        />
      </TestApp>
    );

    // Should show "+2" for remaining members (5 total - 3 visible = 2 remaining)
    expect(screen.getByText('+2')).toBeInTheDocument();

    // Check that the badge has the correct styling
    const badge = screen.getByText('+2').closest('div');
    expect(badge).toHaveClass('rounded-full');
    expect(badge).toHaveClass('bg-gray-600');
    expect(badge).toHaveClass('dark:bg-gray-700');
    expect(badge).toHaveClass('w-8');
    expect(badge).toHaveClass('h-8');
  });

  it('includes moderators and creator in the member display', () => {
    const membersWithModeratorsAndCreator = [
      ...mockMembers,
      { pubkey: 'creator1', role: 'owner' as const, isOnline: true },
      { pubkey: 'mod1', role: 'moderator' as const, isOnline: true },
      { pubkey: 'mod2', role: 'moderator' as const, isOnline: false },
    ];

    render(
      <TestApp>
        <CommunityMemberDisplay
          members={membersWithModeratorsAndCreator}
          isLoading={false}
        />
      </TestApp>
    );

    // Should show total count including all roles (5 members + 1 owner + 2 moderators = 8 total)
    expect(screen.getByText('8 members')).toBeInTheDocument();

    // Should show "+5" badge (8 total - 3 visible = 5 remaining)
    expect(screen.getByText('+5')).toBeInTheDocument();

    // Should display 3 ProfileAvatar components for the first 3 members (regardless of role)
    const profileAvatars = screen.getAllByTestId('mock-profile-avatar');
    expect(profileAvatars).toHaveLength(3);
  });

  it('shows "No members yet" when there are no members', () => {
    render(
      <TestApp>
        <CommunityMemberDisplay
          members={[]}
          isLoading={false}
        />
      </TestApp>
    );

    expect(screen.getByText('No members yet')).toBeInTheDocument();
  });

  it('displays correct member count text including all roles', () => {
    const membersWithModeratorsAndCreator = [
      ...mockMembers,
      { pubkey: 'creator1', role: 'owner' as const, isOnline: true },
      { pubkey: 'mod1', role: 'moderator' as const, isOnline: true },
      { pubkey: 'mod2', role: 'moderator' as const, isOnline: false },
    ];

    render(
      <TestApp>
        <CommunityMemberDisplay
          members={membersWithModeratorsAndCreator}
          isLoading={false}
        />
      </TestApp>
    );

    // Should count all members including creator and moderators (5 + 1 + 2 = 8 total)
    expect(screen.getByText('8 members')).toBeInTheDocument();

    // Verify the count text has the correct styling
    const countText = screen.getByText('8 members');
    expect(countText).toHaveClass('text-xs');
    expect(countText).toHaveClass('text-gray-400');
  });

  it('does not show remaining count badge when there are 3 or fewer members', () => {
    const threeMembers = mockMembers.slice(0, 3); // Only 3 members

    render(
      <TestApp>
        <CommunityMemberDisplay
          members={threeMembers}
          isLoading={false}
        />
      </TestApp>
    );

    // Should NOT show "+X" badge when there are 3 or fewer members
    expect(screen.queryByText(/\+\d/)).not.toBeInTheDocument();

    // Should still show the correct member count
    expect(screen.getByText('3 members')).toBeInTheDocument();

    // Should display exactly 3 ProfileAvatar components (no badge)
    const profileAvatars = screen.getAllByTestId('mock-profile-avatar');
    expect(profileAvatars).toHaveLength(3);
  });
});