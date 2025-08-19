import { useLocalStorage } from './useLocalStorage';

export interface UserSettings {
  showPendingCommunities: boolean;
  enableSpamFiltering: boolean;
  // Add more user settings here as needed
}

const DEFAULT_USER_SETTINGS: UserSettings = {
  showPendingCommunities: false,
  enableSpamFiltering: false, // Disabled by default for debugging
};

/**
 * Hook to manage user-specific settings stored in localStorage
 */
export function useUserSettings() {
  const [settings, setSettings] = useLocalStorage<UserSettings>(
    'user-settings',
    DEFAULT_USER_SETTINGS
  );

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  return { settings, updateSetting };
}
