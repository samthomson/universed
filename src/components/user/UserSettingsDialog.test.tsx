import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { UserSettingsDialog } from './UserSettingsDialog';

// Mock the hooks
vi.mock('@/hooks/useLoginActions', () => ({
  useLoginActions: () => ({
    logout: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: {
      pubkey: 'test-pubkey',
    },
  }),
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({
    data: {
      metadata: {
        name: 'Test User',
      },
    },
  }),
}));

describe('UserSettingsDialog', () => {
  it('renders correctly when open', () => {
    render(
      <TestApp>
        <UserSettingsDialog open={true} onOpenChange={() => {}} />
      </TestApp>
    );

    expect(screen.getByText('User Settings')).toBeInTheDocument();
    expect(screen.getByText('Relay Connection')).toBeInTheDocument();
    expect(screen.getByText('Developer Tools')).toBeInTheDocument();
    expect(screen.getByText('Show Performance Metrics')).toBeInTheDocument();
    expect(screen.getByText('Log Out')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <TestApp>
        <UserSettingsDialog open={false} onOpenChange={() => {}} />
      </TestApp>
    );

    expect(screen.queryByText('User Settings')).not.toBeInTheDocument();
  });

  it('calls onOpenChange when dialog is closed', () => {
    const onOpenChange = vi.fn();

    render(
      <TestApp>
        <UserSettingsDialog open={true} onOpenChange={onOpenChange} />
      </TestApp>
    );

    // Click the X button to close
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('toggles performance dashboard when button is clicked', () => {
    render(
      <TestApp>
        <UserSettingsDialog open={true} onOpenChange={() => {}} />
      </TestApp>
    );

    // Initially should show "Show Performance Metrics"
    const toggleButton = screen.getByText('Show Performance Metrics');
    expect(toggleButton).toBeInTheDocument();

    // Click to toggle
    fireEvent.click(toggleButton);

    // Should now show "Hide Performance Metrics"
    expect(screen.getByText('Hide Performance Metrics')).toBeInTheDocument();
  });
});