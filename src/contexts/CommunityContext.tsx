import { ReactNode } from 'react';
import { CommunityContext } from './CommunityContext';

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


