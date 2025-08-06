import { useContext } from 'react';
import { MessageSystemContext } from '@/contexts/MessageSystemContextBase';
import type { MessageSystemContextValue } from '@/types/messageSystem';

/**
 * Hook to access the message system context
 */
export function useMessageSystem(): MessageSystemContextValue {
  const context = useContext(MessageSystemContext);
  if (!context) {
    throw new Error('useMessageSystem must be used within a MessageSystemProvider');
  }
  return context;
}