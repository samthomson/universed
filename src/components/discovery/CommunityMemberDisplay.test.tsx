import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CommunityMemberDisplay } from './CommunityMemberDisplay';
import { TestApp } from '@/test/TestApp';

// Mock the Avatar component
vi.mock('@/components/ui/avatar', () => ({
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
}));

// Mock the Skeleton component
vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: { className?: string; [key: string]: unknown }) => (
    <div {...props} data-testid="skeleton" className="animate-pulse rounded-md bg-muted" />
  ),
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
    expect(skeletons).toHaveLength(4); // 4 for members only
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

    // Check for avatars
    const avatars = screen.getAllByTestId('avatar');
    expect(avatars.length).toBeGreaterThan(0);
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

    // Should NOT show "Mods:" label since moderator section is removed
    expect(screen.queryByText('Mods:')).not.toBeInTheDocument();
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
  });
});