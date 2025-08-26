import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserSettings } from '@/hooks/useUserSettings';
import { logger } from '@/lib/logger';

interface DataManagerContextType {
  messages: Map<string, unknown[]>;
  isLoading: boolean;
  getDebugInfo: () => { messageCount: number };
  isDebugging: boolean;
}

const DataManagerContext = createContext<DataManagerContextType | null>(null);

export function useDataManager(): DataManagerContextType {
  const context = useContext(DataManagerContext);
  if (!context) {
    throw new Error('useDataManager must be used within DataManagerProvider');
  }
  return context;
}

interface DataManagerProviderProps {
  children: ReactNode;
}

export function DataManagerProvider({ children }: DataManagerProviderProps) {
  const { user } = useCurrentUser();
  const { settings } = useUserSettings();
  
  const [messages, _setMessages] = useState<Map<string, unknown[]>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setIsLoading(false); // Just set to false when user exists
  }, [user]);

  useEffect(() => {
    if (!user) return;
    logger.log(`DataManager: NIP-17 ${settings.enableNIP17 ? 'enabled' : 'disabled'}`);
  }, [settings.enableNIP17, user]);

  const getDebugInfo = () => ({
    messageCount: messages.size,
  });

  const contextValue: DataManagerContextType = {
    messages,
    isLoading,
    getDebugInfo,
    isDebugging: true, // Hardcoded for now
  };

  return (
    <DataManagerContext.Provider value={contextValue}>
      {children}
    </DataManagerContext.Provider>
  );
}
