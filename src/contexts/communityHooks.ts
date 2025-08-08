import { useContext } from 'react';
import { CommunityContext } from './CommunityContext';

export function useCommunityContext() {
  return useContext(CommunityContext);
}