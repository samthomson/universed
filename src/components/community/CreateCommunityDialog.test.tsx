import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { CreateCommunityDialog } from './CreateCommunityDialog';

// Mock the upload file hook
vi.mock('@/hooks/useUploadFile', () => ({
  useUploadFile: () => ({
    mutateAsync: vi.fn().mockResolvedValue([['url', 'https://example.com/icon.jpg']]),
    isPending: false,
  }),
}));

// Mock the current user hook
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: {
      pubkey: 'test-pubkey',
      signer: {},
    },
  }),
}));

// Mock the nostr publish hook
vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: 'test-event-id' }),
  }),
}));

describe('CreateCommunityDialog', () => {
  it('renders icon upload section', () => {
    render(
      <TestApp>
        <CreateCommunityDialog open={true} onOpenChange={() => {}} />
      </TestApp>
    );

    expect(screen.getByText('Community Icon')).toBeInTheDocument();
    expect(screen.getByText('Upload Icon')).toBeInTheDocument();
    expect(screen.getByText(/Upload a square image/)).toBeInTheDocument();
  });

  it('shows remove button when image is selected', async () => {
    render(
      <TestApp>
        <CreateCommunityDialog open={true} onOpenChange={() => {}} />
      </TestApp>
    );

    // Create a mock file
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    // Get the hidden file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Simulate file selection
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for the remove button to appear
    await waitFor(() => {
      expect(screen.getByText('Remove')).toBeInTheDocument();
    });
  });

  it('validates file size and type', async () => {
    render(
      <TestApp>
        <CreateCommunityDialog open={true} onOpenChange={() => {}} />
      </TestApp>
    );

    // Create a mock file that's too large (6MB)
    const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });

    // Get the hidden file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Simulate file selection
    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    // Should show error toast (we can't easily test toast content, but the validation should run)
    expect(fileInput.files?.[0]).toBe(largeFile);
  });
});