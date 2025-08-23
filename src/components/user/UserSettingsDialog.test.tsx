import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { UserSettingsDialog } from './UserSettingsDialog';
import { SettingsProvider, useSettings } from '@/contexts/settings.tsx';

// Mock the hooks that require Nostr context
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

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'dark',
    setTheme: vi.fn(),
  }),
}));

vi.mock('@/hooks/useUserSettings', () => ({
  useUserSettings: () => ({
    settings: {
      showPendingCommunities: false,
      enableSpamFiltering: true,
    },
    updateSetting: vi.fn(),
  }),
}));

// Test component that uses the settings hook
function TestComponent() {
  const { openSettings, isOpen } = useSettings();
  return (
    <div>
      <button onClick={() => openSettings('wallet')}>Open Settings</button>
      <div data-testid="is-open">{isOpen ? 'open' : 'closed'}</div>
    </div>
  );
}

// Wrapper component
function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <TestApp>
      <SettingsProvider>
        {children}
        <UserSettingsDialog />
      </SettingsProvider>
    </TestApp>
  );
}

describe('UserSettingsDialog', () => {
  beforeEach(() => {
    // Clear URL hash before each test
    window.location.hash = '';
  });

  it('opens settings when openSettings() is called', () => {
    render(
      <Wrapper>
        <TestComponent />
      </Wrapper>
    );

    // Initially closed
    expect(screen.getByTestId('is-open')).toHaveTextContent('closed');

    // Click the button that calls openSettings()
    act(() => {
      screen.getByText('Open Settings').click();
    });

    // Should now be open
    expect(screen.getByTestId('is-open')).toHaveTextContent('open');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('opens settings when URL has #settings_wallet', () => {
    // Set URL hash before rendering
    act(() => {
      window.location.hash = '#settings_wallet';
    });

    render(
      <Wrapper>
        <TestComponent />
      </Wrapper>
    );

    // Should be open due to URL hash
    expect(screen.getByTestId('is-open')).toHaveTextContent('open');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    
    // Should open to the wallet tab specifically
    expect(screen.getByText('Wallet Configuration')).toBeInTheDocument();
  });
});