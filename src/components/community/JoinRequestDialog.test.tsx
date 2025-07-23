import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { JoinRequestDialog } from './JoinRequestDialog';

const mockCommunityId = '34550:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:test-community';

describe('JoinRequestDialog', () => {
  it('renders dialog when open', () => {
    render(
      <TestApp>
        <JoinRequestDialog
          communityId={mockCommunityId}
          open={true}
          onOpenChange={vi.fn()}
        />
      </TestApp>
    );

    // Just check that the dialog is rendered (it will show "Community Not Found" since we don't have real data)
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <TestApp>
        <JoinRequestDialog
          communityId={mockCommunityId}
          open={false}
          onOpenChange={vi.fn()}
        />
      </TestApp>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows community not found when communityId is null', () => {
    render(
      <TestApp>
        <JoinRequestDialog
          communityId={null}
          open={true}
          onOpenChange={vi.fn()}
        />
      </TestApp>
    );

    expect(screen.getByText('Community Not Found')).toBeInTheDocument();
  });
});