import { createContext, useContext, useState, ReactNode } from 'react';
import { useIntelligentLRU } from '@/hooks/useIntelligentLRU';

interface MessageSystemContextValue {
  activeCommunityId: string | null;
  setActiveCommunity: (communityId: string | null) => void;
  lruStatus: {
    addToTop: (communityId: string) => void;
    getLRUList: () => unknown[];
    getLoadInfo: () => Record<string, unknown>;
    isPolling: boolean;
    triggerPoll: () => void;
  };
}

const MessageSystemContext = createContext<MessageSystemContextValue | null>(null);

interface MessageSystemProviderProps {
  children: ReactNode;
}

/**
 * Message System Context:
 * - Active community gets real-time subscription
 * - Background communities use intelligent LRU with progressive backoff
 */
export function MessageSystemProvider({ children }: MessageSystemProviderProps) {
  const [activeCommunityId, setActiveCommunityId] = useState<string | null>(null);
  
  // Intelligent LRU background loading (excludes active community)
  const lruStatus = useIntelligentLRU(activeCommunityId);

  const setActiveCommunity = (communityId: string | null) => {
    if (communityId !== activeCommunityId) {
      // Add the new active community to top of LRU (when they leave it)
      if (communityId) {
        lruStatus.addToTop(communityId);
      }
      
      setActiveCommunityId(communityId);
    }
  };

  return (
    <MessageSystemContext.Provider value={{
      activeCommunityId,
      setActiveCommunity,
      lruStatus,
    }}>
      {children}
    </MessageSystemContext.Provider>
  );
}

/**
 * Hook to access the message system context
 */
export function useMessageSystem(): MessageSystemContextValue {
  const context = useContext(MessageSystemContext);
  if (!context) {
    throw new Error('useMessageSystem must be used within a MessageSystemProvider');
  }
  return context;
}