import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { SettingsDialog } from './SettingsDialog';
import { SettingsProvider, useSettings } from '@/contexts/settings.tsx';

// Mock the hooks that require Nostr context
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { pubkey: 'test-pubkey' }
  })
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'dark',
    setTheme: vi.fn()
  })
}));

vi.mock('@/hooks/useUserSettings', () => ({
  useUserSettings: () => ({
    settings: {
      showPendingCommunities: false,
      enableSpamFiltering: true
    },
    updateSetting: vi.fn()
  })
}));

vi.mock('@/components/RelaySelector', () => ({
  RelaySelector: () => <div data-testid="relay-selector">Relay Selector</div>
}));

vi.mock('@/components/WalletConfigDialog', () => ({
  WalletConfigDialog: () => <div data-testid="wallet-config">Wallet Config</div>
}));

vi.mock('@/components/dm/MessagingSettings', () => ({
  MessagingSettings: () => <div data-testid="messaging-settings">Messaging Settings</div>
}));

vi.mock('@/components/EditProfileForm', () => ({
  EditProfileForm: () => <div data-testid="edit-profile-form">Edit Profile Form</div>
}));

// Test component to trigger settings
function TestTrigger() {
  const { openSettings } = useSettings();
  return <button onClick={() => openSettings()} data-testid="open-settings">Open Settings</button>;
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <TestApp>
      <SettingsProvider>
        {children}
        <SettingsDialog />
      </SettingsProvider>
    </TestApp>
  );
}

describe('SettingsDialog', () => {
  beforeEach(() => {
    // Clear URL hash before each test
    window.location.hash = '';
  });

  it('opens when triggered', async () => {
    render(
      <Wrapper>
        <TestTrigger />
      </Wrapper>
    );

    // Initially closed
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();

    // Open settings
    await act(async () => {
      screen.getByTestId('open-settings').click();
    });

    // Should be open now
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('shows all tabs', async () => {
    render(
      <Wrapper>
        <TestTrigger />
      </Wrapper>
    );

    await act(async () => {
      screen.getByTestId('open-settings').click();
    });

    // Check all tabs are present - use getAllByText since there are multiple instances
    expect(screen.getAllByText('Profile')).toHaveLength(2); // Tab + heading
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Connection')).toBeInTheDocument();
    expect(screen.getByText('Wallet')).toBeInTheDocument();
    expect(screen.getByText('Communities')).toBeInTheDocument();
    expect(screen.getByText('Messaging')).toBeInTheDocument();
  });

  it('shows profile content by default', async () => {
    render(
      <Wrapper>
        <TestTrigger />
      </Wrapper>
    );

    await act(async () => {
      screen.getByTestId('open-settings').click();
    });

    expect(screen.getByTestId('edit-profile-form')).toBeInTheDocument();
  });
});
