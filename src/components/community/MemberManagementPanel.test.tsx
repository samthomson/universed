import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { MemberManagementPanel } from './MemberManagementPanel';

// Mock the hooks
vi.mock('@/hooks/useCommunityMemberLists', () => ({
  useCommunityMemberLists: vi.fn(() => ({
    data: {
      approved: ['pubkey1', 'pubkey2'],
      declined: ['pubkey3'],
      banned: ['pubkey4'],
    },
    isLoading: false,
  })),
}));

vi.mock('@/hooks/useManageMembers', () => ({
  useManageMembers: vi.fn(() => ({
    addMember: vi.fn(),
    declineMember: vi.fn(),
    banMember: vi.fn(),
    isAddingMember: false,
    isRemovingMember: false,
    isDecliningMember: false,
    isBanningMember: false,
  })),
}));

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
    render(
      <TestApp>
        <MemberManagementPanel communityId={null} />
      </TestApp>
    );

    expect(screen.getByText('No community selected')).toBeInTheDocument();
  });
});