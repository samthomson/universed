import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Settings tab constants
export const SETTINGS_TABS = {
  APPEARANCE: 'appearance',
  CONNECTION: 'connection', 
  WALLET: 'wallet',
  COMMUNITIES: 'communities',
  MESSAGING: 'messaging',
} as const;

export type SettingsTab = typeof SETTINGS_TABS[keyof typeof SETTINGS_TABS];

// Settings context and hook
interface SettingsContextType {
  isOpen: boolean;
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
  activeTab: SettingsTab;
  setActiveTab: (tab: SettingsTab) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}

// Settings provider component
interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>(SETTINGS_TABS.APPEARANCE);

  // Handle URL hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1); // Remove the # symbol
      if (hash.startsWith('settings_')) {
        const tab = hash.replace('settings_', '') as SettingsTab;
        if (Object.values(SETTINGS_TABS).includes(tab)) {
          setActiveTab(tab);
          setIsOpen(true);
        }
      }
    };

    // Check hash on mount
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const openSettings = (tab?: SettingsTab) => {
    if (tab) {
      setActiveTab(tab);
      // Update URL hash without triggering a page reload
      window.history.replaceState(null, '', `#settings_${tab}`);
    }
    setIsOpen(true);
  };

  const closeSettings = () => {
    setIsOpen(false);
    // Remove settings hash when closing
    if (window.location.hash.startsWith('#settings_')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  return (
    <SettingsContext.Provider value={{ 
      isOpen, 
      openSettings, 
      closeSettings,
      activeTab,
      setActiveTab
    }}>
      {children}
    </SettingsContext.Provider>
  );
}
