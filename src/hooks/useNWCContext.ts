import { useContext } from 'react';
import { NWCContext } from '@/contexts/NWCContext';

export function useNWC() {
  const context = useContext(NWCContext);
  if (!context) {
    throw new Error('useNWC must be used within a NWCProvider');
  }
  return context;
}