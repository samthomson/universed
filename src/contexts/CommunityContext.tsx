import { createContext, useContext, ReactNode } from 'react';

interface CommunityContextType {
  currentCommunityId: string | null;
}

const CommunityContext = createContext<CommunityContextType>({
  currentCommunityId: null,
});

interface CommunityProviderProps {
  children: ReactNode;
  currentCommunityId: string | null;
}

export function CommunityProvider({ children, currentCommunityId }: CommunityProviderProps) {
  return (
    <CommunityContext.Provider value={{ currentCommunityId }}>
      {children}
    </CommunityContext.Provider>
  );
}

export function useCommunityContext() {
  return useContext(CommunityContext);
}
