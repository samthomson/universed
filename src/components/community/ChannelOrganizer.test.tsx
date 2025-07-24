import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { ChannelOrganizer } from './ChannelOrganizer';

// Mock the hooks to control loading states
vi.mock('@/hooks/useChannels', () => ({
  useChannels: vi.fn(() => ({
    data: [],
    isLoading: true,
  })),
}));

vi.mock('@/hooks/useChannelFolders', () => ({
  useChannelFolders: vi.fn(() => ({
    data: [],
    isLoading: true,
  })),
}));

vi.mock('@/hooks/useCommunityRoles', () => ({
  useCanModerate: vi.fn(() => ({
    canModerate: false,
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

    // Check that skeleton elements are present
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});