import { createContext } from 'react';

export interface VoiceState {
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
}

export interface VoiceContextType {
  // State
  voiceState: VoiceState;

  // Actions
  toggleMute: () => void;
  toggleDeafen: () => void;
  setMuted: (muted: boolean) => void;
  setDeafened: (deafened: boolean) => void;
  setSpeaking: (speaking: boolean) => void;

  // Actual audio control functions (to be registered by useVoiceChannel)
  registerAudioControls: (controls: {
    toggleMute: () => Promise<void>;
    toggleDeafen: () => Promise<void>;
    setMuted: (muted: boolean) => Promise<void>;
    setDeafened: (deafened: boolean) => Promise<void>;
  }) => void;
  unregisterAudioControls: () => void;

  // Voice channel connection state
  isConnectedToVoice: boolean;
  setIsConnectedToVoice: (connected: boolean) => void;
}

export const VoiceContext = createContext<VoiceContextType | undefined>(undefined);