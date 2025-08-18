import { useState, useEffect, useCallback } from 'react';

// Global event emitter for localStorage changes within the same tab
class LocalStorageEventEmitter {
  private listeners = new Map<string, Set<(value: any) => void>>();

  subscribe(key: string, callback: (value: any) => void) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);

    return () => {
      const keyListeners = this.listeners.get(key);
      if (keyListeners) {
        keyListeners.delete(callback);
        if (keyListeners.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  emit(key: string, value: any) {
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach(callback => callback(value));
    }
  }
}

const localStorageEmitter = new LocalStorageEventEmitter();

/**
 * Reactive localStorage hook that syncs changes across all components in the same tab
 */
export function useReactiveLocalStorage<T>(
  key: string,
  defaultValue: T,
  serializer?: {
    serialize: (value: T) => string;
    deserialize: (value: string) => T;
  }
) {
  const serialize = serializer?.serialize || JSON.stringify;
  const deserialize = serializer?.deserialize || JSON.parse;

  const [state, setState] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? deserialize(item) : defaultValue;
    } catch (error) {
      console.warn(`Failed to load ${key} from localStorage:`, error);
      return defaultValue;
    }
  });

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(state) : value;
      setState(valueToStore);
      localStorage.setItem(key, serialize(valueToStore));
      
      // Emit change to other components in the same tab
      localStorageEmitter.emit(key, valueToStore);
    } catch (error) {
      console.warn(`Failed to save ${key} to localStorage:`, error);
    }
  }, [key, serialize, state]);

  // Listen for changes from other components in the same tab
  useEffect(() => {
    const unsubscribe = localStorageEmitter.subscribe(key, (newValue: T) => {
      setState(newValue);
    });

    return unsubscribe;
  }, [key]);

  // Sync with localStorage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const newValue = deserialize(e.newValue);
          setState(newValue);
          // Also emit to other components in this tab
          localStorageEmitter.emit(key, newValue);
        } catch (error) {
          console.warn(`Failed to sync ${key} from localStorage:`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, deserialize]);

  return [state, setValue] as const;
}
