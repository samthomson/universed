import { useReactiveLocalStorage } from './useReactiveLocalStorage';

export interface UserSettings {
  showPendingCommunities: boolean;
  enableSpamFiltering: boolean;
  enableNIP17: boolean;
  // Add more user settings here as needed
}

const DEFAULT_USER_SETTINGS: UserSettings = {
  showPendingCommunities: false,
  enableSpamFiltering: false, // Disabled by default for debugging
  enableNIP17: true, // Enable NIP17 by default
};

/**
 * Hook to manage user-specific settings stored in localStorage
 */
export function useUserSettings() {
  const [settings, setSettings] = useReactiveLocalStorage<UserSettings>(
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
