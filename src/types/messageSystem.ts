export interface IntelligentLRUReturn {
  addToTop: (communityId: string) => void;
  getLRUList: () => string[];
  getLoadInfo: () => Record<string, { loadCount: number; lastLoadTime: number }>;
  isPolling: boolean;
  triggerPoll: () => Promise<void>;
}

export interface MessageSystemContextValue {
  activeCommunityId: string | null;
  setActiveCommunity: (communityId: string | null) => void;
  lruStatus: IntelligentLRUReturn;
}