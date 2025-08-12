import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { ProfileModal } from './ProfileModal';

// Mock the useAuthor hook to provide test data
const mockAuthor = {
  data: {
    metadata: {
      name: 'Test User',
      picture: 'https://example.com/avatar.jpg',
      about: 'Test user bio',
      website: 'https://example.com',
      nip05: 'test@example.com'
    }
  },
  isLoading: false,
  error: null
};

// Mock the useUserStatus hook
const mockUserStatus = {
  emoji: '🌟',
  message: 'Test status',
  status: 'online'
};

// Mock the useUserMusicStatus hook
const mockMusicStatus = {
  content: 'Test Song',
  link: 'https://example.com/song'
};

// Mock the useCommunities hook
const mockCommunities = [];

// Mock the useIsFriend hook
const mockIsFriend = false;

// Mock the useManageFriends hook
const mockManageFriends = {
  addFriend: vi.fn(),
  removeFriend: vi.fn(),
  isAddingFriend: false,
  isRemovingFriend: false
};

// Mock the useIsMuted hook
const mockIsMuted = false;

// Mock the useManageMutedUsers hook
const mockManageMutedUsers = {
  muteUser: vi.fn(),
  unmuteUser: vi.fn(),
  isMuting: false,
  isUnmuting: false
};

// Mock the useNostr hook
const mockNostr = {
  nostr: {
    query: vi.fn()
  }
};

// Mock the useQuery hook
const mockUseQuery = vi.fn();

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: vi.fn(() => mockAuthor)
}));

vi.mock('@/hooks/useUserStatus', () => ({
  useUserStatus: vi.fn(() => ({ data: mockUserStatus })),
  useUserMusicStatus: vi.fn(() => ({ data: mockMusicStatus })),
  getTraditionalStatusText: vi.fn(() => 'Online')
}));

vi.mock('@/hooks/useCommunities', () => ({
  useCommunities: vi.fn(() => ({ data: mockCommunities }))
}));

vi.mock('@/hooks/useFriends', () => ({
  useIsFriend: vi.fn(() => mockIsFriend)
}));

vi.mock('@/hooks/useManageFriends', () => ({
  useManageFriends: vi.fn(() => mockManageFriends)
}));

vi.mock('@/hooks/useMutedUsers', () => ({
  useIsMuted: vi.fn(() => mockIsMuted)
}));

vi.mock('@/hooks/useManageMutedUsers', () => ({
  useManageMutedUsers: vi.fn(() => mockManageMutedUsers)
}));

vi.mock('@nostrify/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nostrify/react')>();
  return {
    ...actual,
    useNostr: vi.fn(() => mockNostr)
  };
});

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn(() => mockUseQuery)
  };
});

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => ({
    user: {
      pubkey: 'test-pubkey-123',
      signer: {
        nip44: {
          encrypt: vi.fn(),
          decrypt: vi.fn()
        }
      }
    }
  }))
}));

describe('ProfileModal', () => {
  it('renders profile modal correctly', () => {
    render(
      <TestApp>
        <ProfileModal
          open={true}
          onOpenChange={vi.fn()}
          onOpenSettings={vi.fn()}
        />
      </TestApp>
    );

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('Test user bio')).toBeInTheDocument();
  });

  it('handles URL wrapping in activity content', () => {
    // Mock user activity with long URLs
    const mockUserActivity = {
      notes: [
        {
          id: 'test-note-1',
          pubkey: 'test-pubkey-123',
          kind: 1,
          content: 'Check out this very long URL: https://example.com/very/long/path/that/should/be/wrapped/to/prevent/layout/breaking/issues/in/the/profile/modal/recent/activities/section',
          tags: [],
          created_at: Math.floor(Date.now() / 1000),
          sig: 'test-sig'
        }
      ],
      images: [],
      articles: []
    };

    mockUseQuery.mockReturnValue({ data: mockUserActivity });

    render(
      <TestApp>
        <ProfileModal
          open={true}
          onOpenChange={vi.fn()}
          onOpenSettings={vi.fn()}
        />
      </TestApp>
    );

    // The content should be rendered with the URL wrapped
    expect(screen.getByText(/Check out this very long URL:/)).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/example.com\/very\/long\/path\/that\/should\/be\/wrapped\/to\/prevent\/layout\/breaking\/issues\/in\/the\/profile\/modal\/recent\/activities\/section/)).toBeInTheDocument();
  });

  it('handles video URLs in content', () => {
    // Mock user activity with video URLs
    const mockUserActivity = {
      notes: [
        {
          id: 'test-note-2',
          pubkey: 'test-pubkey-123',
          kind: 1,
          content: 'Watch this video: https://youtube.com/watch?v=verylongvideoidthatshouldnotbreaklayout and also check this: https://vimeo.com/verylongvideoidthatshouldalsobewrappedproperly',
          tags: [],
          created_at: Math.floor(Date.now() / 1000),
          sig: 'test-sig'
        }
      ],
      images: [],
      articles: []
    };

    mockUseQuery.mockReturnValue({ data: mockUserActivity });

    render(
      <TestApp>
        <ProfileModal
          open={true}
          onOpenChange={vi.fn()}
          onOpenSettings={vi.fn()}
        />
      </TestApp>
    );

    // The content should be rendered with video URLs wrapped
    expect(screen.getByText(/Watch this video:/)).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/youtube.com\/watch\?v=verylongvideoidthatshouldnotbreaklayout/)).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/vimeo.com\/verylongvideoidthatshouldalsobewrappedproperly/)).toBeInTheDocument();
  });

  it('handles mixed content with images and URLs', () => {
    // Mock user activity with mixed content
    const mockUserActivity = {
      notes: [
        {
          id: 'test-note-3',
          pubkey: 'test-pubkey-123',
          kind: 1,
          content: 'Here is an image: ![alt](https://example.com/image.jpg) and a long URL: https://example.com/very/long/path/that/should/be/wrapped properly',
          tags: [],
          created_at: Math.floor(Date.now() / 1000),
          sig: 'test-sig'
        }
      ],
      images: [],
      articles: []
    };

    mockUseQuery.mockReturnValue({ data: mockUserActivity });

    render(
      <TestApp>
        <ProfileModal
          open={true}
          onOpenChange={vi.fn()}
          onOpenSettings={vi.fn()}
        />
      </TestApp>
    );

    // The content should be rendered without the image markdown but with the URL wrapped
    expect(screen.getByText(/Here is an image:/)).toBeInTheDocument();
    expect(screen.getByText(/and a long URL:/)).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/example.com\/very\/long\/path\/that\/should\/be\/wrapped/)).toBeInTheDocument();
  });
});