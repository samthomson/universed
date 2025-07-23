import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { CreateChannelDialog } from './CreateChannelDialog';

// Mock the hooks
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: null,
  }),
}));

vi.mock('@/hooks/useCommunities', () => ({
  useCommunities: () => ({
    data: [],
  }),
}));

vi.mock('@/hooks/useUserMembership', () => ({
  useUserMembership: () => ({
    data: [],
  }),
}));

vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: vi.fn(),
  }),
}));

describe('CreateChannelDialog', () => {
  it('renders without crashing', () => {
    // This test just verifies the component renders without errors
    const { container } = render(
      <TestApp>
        <CreateChannelDialog communityId="test-community" />
      </TestApp>
    );

    // Component should render (even if it returns null for non-privileged users)
    expect(container).toBeDefined();
  });

  it('handles missing community gracefully', () => {
    const { container } = render(
      <TestApp>
        <CreateChannelDialog communityId="non-existent-community" />
      </TestApp>
    );

    expect(container).toBeDefined();
  });
});