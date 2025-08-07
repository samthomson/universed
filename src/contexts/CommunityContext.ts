import { createContext } from 'react';

interface CommunityContextType {
  currentCommunityId: string | null;
}

export const CommunityContext = createContext<CommunityContextType>({
  currentCommunityId: null,
});