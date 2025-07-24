import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { ChannelOrganizer } from './ChannelOrganizer';

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
});