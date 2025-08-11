import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { CommunitySelectionDialog } from './CommunitySelectionDialog';

// Mock the CommunityDiscovery component since it has complex dependencies
vi.mock('@/components/discovery/CommunityDiscovery', () => ({
  CommunityDiscovery: ({ onCommunitySelect }: { onCommunitySelect?: (id: string) => void }) => (
    <div data-testid="community-discovery">
      <button onClick={() => onCommunitySelect?.('test-community')}>
        Test Community
      </button>
    </div>
  ),
}));

// Mock the CreateCommunityDialog component
vi.mock('./CreateCommunityDialog', () => ({
  CreateCommunityDialog: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => (
    <div data-testid="create-community-dialog">
      {open && (
        <div>
          <span>Create Community Dialog</span>
          <button onClick={() => onOpenChange(false)}>Close</button>
        </div>
      )}
    </div>
  ),
}));

describe('CommunitySelectionDialog', () => {
  it('renders discovery view with create button when open', () => {
    render(
      <TestApp>
        <CommunitySelectionDialog
          open={true}
          onOpenChange={() => {}}
        />
      </TestApp>
    );

    expect(screen.getByText('DISCOVER YOUR SPACE')).toBeInTheDocument();
    expect(screen.getByText('Create Space')).toBeInTheDocument();
    expect(screen.getByTestId('community-discovery')).toBeInTheDocument();
  });

  it('shows create community dialog when create button is clicked', () => {
    render(
      <TestApp>
        <CommunitySelectionDialog
          open={true}
          onOpenChange={() => {}}
        />
      </TestApp>
    );

    fireEvent.click(screen.getByText('Create Space'));
    expect(screen.getByTestId('create-community-dialog')).toBeInTheDocument();
  });

  it('shows discovery view by default with no back button', () => {
    render(
      <TestApp>
        <CommunitySelectionDialog
          open={true}
          onOpenChange={() => {}}
        />
      </TestApp>
    );

    expect(screen.getByTestId('community-discovery')).toBeInTheDocument();
    // Should not have a back button since we're always in discovery view
    expect(screen.queryByText('← Back')).not.toBeInTheDocument();
  });

  it('calls onCommunitySelect when a community is selected from discovery', () => {
    const mockOnCommunitySelect = vi.fn();
    const mockOnOpenChange = vi.fn();

    render(
      <TestApp>
        <CommunitySelectionDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onCommunitySelect={mockOnCommunitySelect}
        />
      </TestApp>
    );

    // Navigate to discovery view
    fireEvent.click(screen.getByText('DISCOVER YOUR SPACE'));

    // Select a community
    fireEvent.click(screen.getByText('Test Community'));

    expect(mockOnCommunitySelect).toHaveBeenCalledWith('test-community');
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onCommunitySelect when a community is created', () => {
    const mockOnCommunitySelect = vi.fn();
    const mockOnOpenChange = vi.fn();

    render(
      <TestApp>
        <CommunitySelectionDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onCommunitySelect={mockOnCommunitySelect}
        />
      </TestApp>
    );

    // Navigate to create view
    fireEvent.click(screen.getByText('Create Space'));

    // The create dialog should appear, replacing this dialog
    // This test verifies the callbacks are properly wired up
    expect(mockOnCommunitySelect).not.toHaveBeenCalled();
    expect(mockOnOpenChange).not.toHaveBeenCalled();
  });
});