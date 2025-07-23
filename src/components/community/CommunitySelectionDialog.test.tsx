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
  it('renders selection options when open', () => {
    render(
      <TestApp>
        <CommunitySelectionDialog
          open={true}
          onOpenChange={() => {}}
        />
      </TestApp>
    );

    expect(screen.getByText('Add a Community')).toBeInTheDocument();
    expect(screen.getByText('Create New Community')).toBeInTheDocument();
    expect(screen.getByText('Discover Communities')).toBeInTheDocument();
  });

  it('shows create community dialog when create option is clicked', () => {
    render(
      <TestApp>
        <CommunitySelectionDialog
          open={true}
          onOpenChange={() => {}}
        />
      </TestApp>
    );

    fireEvent.click(screen.getByText('Create New Community'));
    expect(screen.getByTestId('create-community-dialog')).toBeInTheDocument();
  });

  it('shows discovery view when discover option is clicked', () => {
    render(
      <TestApp>
        <CommunitySelectionDialog
          open={true}
          onOpenChange={() => {}}
        />
      </TestApp>
    );

    fireEvent.click(screen.getByText('Discover Communities'));
    expect(screen.getByTestId('community-discovery')).toBeInTheDocument();
    expect(screen.getByText('← Back')).toBeInTheDocument();
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
    fireEvent.click(screen.getByText('Discover Communities'));
    
    // Select a community
    fireEvent.click(screen.getByText('Test Community'));

    expect(mockOnCommunitySelect).toHaveBeenCalledWith('test-community');
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});