import { useReactiveLocalStorage } from '@/hooks/useReactiveLocalStorage';

export type DefaultProtocol = 'nip04' | 'nip17' | 'auto';

/**
 * Centralized hook for managing the default protocol setting.
 * This ensures all components that use this setting stay in sync.
 */
export function useDefaultProtocolSetting() {
  return useReactiveLocalStorage<DefaultProtocol>('defaultMessagingProtocol', 'auto');
}
