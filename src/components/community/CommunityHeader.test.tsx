import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { CommunityHeader } from './CommunityHeader';

// Mock the hooks used by CommunityHeader
vi.mock('@/hooks/useCommunities', () => ({
  useCommunities: () => ({
    data: [
      {
        id: 'test-community-id',
        name: 'Test Community',
        description: 'A test community',
        image: 'https://example.com/image.jpg',
        relays: ['wss://relay.example.com']
      }
    ]
  })
}));

vi.mock('@/hooks/useCommunityRoles', () => ({
  useCanModerate: () => ({ canModerate: false })
}));

vi.mock('@/hooks/useLeaveCommunity', () => ({
  useLeaveCommunity: () => ({
    mutate: vi.fn(),
    isPending: false
  })
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: vi.fn() })
}));

describe('CommunityHeader', () => {
  it('renders tabs with correct labels', () => {
    render(
      <TestApp>
        <CommunityHeader
          communityId="test-community-id"
          activeTab="channels"
          onTabChange={vi.fn()}
        />
      </TestApp>
    );

    // Check that all tabs are rendered
    expect(screen.getByText('Channels')).toBeInTheDocument();
    expect(screen.getByText('Marketplace')).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
  });

  it('calls onTabChange when a tab is clicked', () => {
    const mockOnTabChange = vi.fn();

    render(
      <TestApp>
        <CommunityHeader
          communityId="test-community-id"
          activeTab="channels"
          onTabChange={mockOnTabChange}
        />
      </TestApp>
    );

    // Click on the Marketplace tab
    const marketplaceTab = screen.getByText('Marketplace');
    fireEvent.click(marketplaceTab);

    // Verify that onTabChange was called with the correct tab id
    expect(mockOnTabChange).toHaveBeenCalledWith('marketplace');
  });

  it('applies active styling to the correct tab', () => {
    const { rerender } = render(
      <TestApp>
        <CommunityHeader
          communityId="test-community-id"
          activeTab="channels"
          onTabChange={vi.fn()}
        />
      </TestApp>
    );

    // Initially, channels tab should be active (blue text)
    const channelsTab = screen.getByText('Channels').closest('label');
    expect(channelsTab).toHaveClass('text-blue-600');

    // Rerender with marketplace as active tab
    rerender(
      <TestApp>
        <CommunityHeader
          communityId="test-community-id"
          activeTab="marketplace"
          onTabChange={vi.fn()}
        />
      </TestApp>
    );

    // Now marketplace tab should be active
    const marketplaceTab = screen.getByText('Marketplace').closest('label');
    expect(marketplaceTab).toHaveClass('text-blue-600');

    // And channels tab should not be active
    const channelsTabAfter = screen.getByText('Channels').closest('label');
    expect(channelsTabAfter).not.toHaveClass('text-blue-600');
  });

  it('renders community name and description', () => {
    render(
      <TestApp>
        <CommunityHeader
          communityId="test-community-id"
          activeTab="channels"
          onTabChange={vi.fn()}
        />
      </TestApp>
    );

    expect(screen.getByText('Test Community')).toBeInTheDocument();
    expect(screen.getByText('A test community')).toBeInTheDocument();
  });
});