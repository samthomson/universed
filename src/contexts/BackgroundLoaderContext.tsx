import { createContext, useContext, useRef, ReactNode } from 'react';
import { useBackgroundLoader } from '@/hooks/useBackgroundLoader';

interface BackgroundLoaderContextValue {
  markCommunityActive: (communityId: string) => void;
  markCommunityInactive: (communityId: string) => void;
  addCommunityToBackgroundLoading: (communityId: string) => void;
  triggerBackgroundLoad: () => void;
  getLoadingState: () => any;
  clearLoadedCache: () => void;
}

const BackgroundLoaderContext = createContext<BackgroundLoaderContextValue | null>(null);

interface BackgroundLoaderProviderProps {
  children: ReactNode;
}

/**
 * Provider that creates a single instance of the background loader
 * and exposes its controls through React Context.
 */
export function BackgroundLoaderProvider({ children }: BackgroundLoaderProviderProps) {
  const backgroundLoader = useBackgroundLoader();
  
  return (
    <BackgroundLoaderContext.Provider value={backgroundLoader}>
      {children}
    </BackgroundLoaderContext.Provider>
  );
}

/**
 * Hook to access the singleton background loader instance.
 * This ensures all components use the same background loader.
 */
export function useBackgroundLoaderControls(): BackgroundLoaderContextValue {
  const context = useContext(BackgroundLoaderContext);
  if (!context) {
    throw new Error('useBackgroundLoaderControls must be used within a BackgroundLoaderProvider');
  }
  return context;
}

/**
 * Hook to track the currently active community and automatically
 * manage background loading state.
 */
export function useActiveCommunitySetter() {
  const { markCommunityActive, markCommunityInactive } = useBackgroundLoaderControls();
  const currentCommunityRef = useRef<string | null>(null);

  const setActiveCommunity = (communityId: string | null) => {
    const previousCommunity = currentCommunityRef.current;
    
    // Mark previous community as inactive
    if (previousCommunity && previousCommunity !== communityId) {
      markCommunityInactive(previousCommunity);
    }

    // Mark new community as active  
    if (communityId) {
      markCommunityActive(communityId);
    }

    currentCommunityRef.current = communityId;
  };

  return { setActiveCommunity };
}