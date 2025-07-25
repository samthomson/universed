import { useCallback, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

interface VisitHistory {
  [communityId: string]: number; // timestamp of last visit
}

interface ChannelVisitHistory {
  [key: string]: number; // communityId:channelId -> timestamp
}

/**
 * Hook to track user visit history for communities and channels
 * Used to prioritize background loading based on user behavior
 */
export function useVisitHistory() {
  const [communityHistory, setCommunityHistory] = useLocalStorage<VisitHistory>('community-visit-history', {});
  const [channelHistory, setChannelHistory] = useLocalStorage<ChannelVisitHistory>('channel-visit-history', {});

  // Record a community visit
  const recordCommunityVisit = useCallback((communityId: string) => {
    setCommunityHistory(prev => ({
      ...prev,
      [communityId]: Date.now()
    }));
  }, [setCommunityHistory]);

  // Record a channel visit
  const recordChannelVisit = useCallback((communityId: string, channelId: string) => {
    const key = `${communityId}:${channelId}`;
    setChannelHistory(prev => ({
      ...prev,
      [key]: Date.now()
    }));
  }, [setChannelHistory]);

  // Get last visit time for a community
  const getLastCommunityVisit = useCallback((communityId: string): number | null => {
    return communityHistory[communityId] || null;
  }, [communityHistory]);

  // Get last visit time for a channel
  const getLastChannelVisit = useCallback((communityId: string, channelId: string): number | null => {
    const key = `${communityId}:${channelId}`;
    return channelHistory[key] || null;
  }, [channelHistory]);

  // Get most recently visited communities
  const getRecentCommunities = useCallback((limit: number = 5): string[] => {
    return Object.entries(communityHistory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([communityId]) => communityId);
  }, [communityHistory]);

  // Get most recently visited channels for a community
  const getRecentChannels = useCallback((communityId: string, limit: number = 3): string[] => {
    return Object.entries(channelHistory)
      .filter(([key]) => key.startsWith(`${communityId}:`))
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([key]) => key.split(':')[1]);
  }, [channelHistory]);

  // Clean up old history entries (older than 30 days)
  const cleanupOldHistory = useCallback(() => {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    setCommunityHistory(prev => {
      const cleaned: VisitHistory = {};
      Object.entries(prev).forEach(([id, timestamp]) => {
        if (timestamp > thirtyDaysAgo) {
          cleaned[id] = timestamp;
        }
      });
      return cleaned;
    });

    setChannelHistory(prev => {
      const cleaned: ChannelVisitHistory = {};
      Object.entries(prev).forEach(([key, timestamp]) => {
        if (timestamp > thirtyDaysAgo) {
          cleaned[key] = timestamp;
        }
      });
      return cleaned;
    });
  }, [setCommunityHistory, setChannelHistory]);

  // Clean up old entries on mount
  useEffect(() => {
    cleanupOldHistory();
  }, [cleanupOldHistory]);

  return {
    recordCommunityVisit,
    recordChannelVisit,
    getLastCommunityVisit,
    getLastChannelVisit,
    getRecentCommunities,
    getRecentChannels,
    cleanupOldHistory,
  };
}