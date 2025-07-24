import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { SpacesNavigator } from './SpacesNavigator';

// Mock the hooks to control loading states
vi.mock('@/hooks/useSpaces', () => ({
  useSpaces: vi.fn(() => ({
    data: undefined,
    isLoading: true,
  })),
}));

vi.mock('@/hooks/useCommunityRoles', () => ({
  useCanModerate: vi.fn(() => ({
    canModerate: false,
  })),
}));

describe('SpacesNavigator', () => {
  it('shows loading skeleton when data is loading', () => {
    render(
      <TestApp>
        <SpacesNavigator
          communityId="test-community"
          selectedSpace={null}
          onSelectSpace={() => {}}
        />
      </TestApp>
    );

    // Check that skeleton elements are present
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});