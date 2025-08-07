import { useContext } from 'react';
import { CommunityContext } from './CommunityContext.ts';

export function useCommunityContext() {
  return useContext(CommunityContext);
}