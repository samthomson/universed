import { createContext } from 'react';
import type { MessageSystemContextValue } from '@/types/messageSystem';

export const MessageSystemContext = createContext<MessageSystemContextValue | null>(null);