import { useContext } from 'react';
import { VoiceContext } from './VoiceContext.ts';

export function useVoiceContext() {
  const context = useContext(VoiceContext);
  if (context === undefined) {
    throw new Error('useVoiceContext must be used within a VoiceProvider');
  }
  return context;
}

// Custom hooks for specific state access
export function useVoiceMuteState() {
  const { voiceState, toggleMute, setMuted } = useVoiceContext();
  return {
    isMuted: voiceState.isMuted,
    toggleMute,
    setMuted,
  };
}

export function useVoiceDeafenState() {
  const { voiceState, toggleDeafen, setDeafened } = useVoiceContext();
  return {
    isDeafened: voiceState.isDeafened,
    toggleDeafen,
    setDeafened,
  };
}

export function useVoiceSpeakingState() {
  const { voiceState, setSpeaking } = useVoiceContext();
  return {
    isSpeaking: voiceState.isSpeaking,
    setSpeaking,
  };
}

export function useVoiceConnectionState() {
  const { isConnectedToVoice, setIsConnectedToVoice } = useVoiceContext();
  return {
    isConnectedToVoice,
    setIsConnectedToVoice,
  };
}