import { useState, ReactNode } from 'react';
import { useIntelligentLRU } from '@/hooks/useIntelligentLRU';
import { MessageSystemContext } from './MessageSystemContextBase';

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

