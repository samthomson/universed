import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { CommunityShareDialog } from './CommunityShareDialog';
import type { Community } from '@/hooks/useCommunities';

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
});

const mockCommunity: Community = {
  id: '34550:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:test-community',
  name: 'Test Community',
  description: 'A test community for sharing',
  creator: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  moderators: ['abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'],
  relays: ['wss://relay.example.com'],
  event: {
    id: 'event_id',
    kind: 34550,
    pubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    created_at: 1234567890,
    content: '',
    tags: [
      ['d', 'test-community'],
      ['name', 'Test Community'],
      ['description', 'A test community for sharing'],
    ],
    sig: 'signature',
  },
};

describe('CommunityShareDialog', () => {
  it('renders share dialog with community information', () => {
    render(
      <TestApp>
        <CommunityShareDialog community={mockCommunity}>
          <button>Share</button>
        </CommunityShareDialog>
      </TestApp>
    );

    expect(screen.getByText('Share')).toBeInTheDocument();
  });

  it('generates naddr without errors', () => {
    // This test just ensures the component renders without throwing errors
    // when generating the naddr for a valid community
    render(
      <TestApp>
        <CommunityShareDialog community={mockCommunity}>
          <button>Share</button>
        </CommunityShareDialog>
      </TestApp>
    );

    expect(screen.getByText('Share')).toBeInTheDocument();
  });
});