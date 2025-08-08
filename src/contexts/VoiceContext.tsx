import React, { useState, useCallback, useRef, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { VoiceContext, VoiceState, VoiceContextType } from './VoiceContext';

interface VoiceProviderProps {
  children: ReactNode;
}

export function VoiceProvider({ children }: VoiceProviderProps) {
  const queryClient = useQueryClient();

  const [voiceState, setVoiceState] = useState<VoiceState>({
    isMuted: false,
    isDeafened: false,
    isSpeaking: false,
  });

  const [isConnectedToVoice, setIsConnectedToVoice] = useState(false);

  // Store for actual audio control functions
  const audioControlsRef = useRef<{
    toggleMute?: () => Promise<void>;
    toggleDeafen?: () => Promise<void>;
    setMuted?: (muted: boolean) => Promise<void>;
    setDeafened?: (deafened: boolean) => Promise<void>;
  } | null>(null);

  const setSpeaking = useCallback((speaking: boolean) => {
    // Optimistic UI update first - update state immediately
    setVoiceState(prev => ({ ...prev, isSpeaking: speaking }));

    // Invalidate voice channel queries to refresh UI immediately
    queryClient.invalidateQueries({ queryKey: ['voice-channel'] });
  }, [queryClient]);

  const registerAudioControls = useCallback((controls: {
    toggleMute: () => Promise<void>;
    toggleDeafen: () => Promise<void>;
    setMuted: (muted: boolean) => Promise<void>;
    setDeafened: (deafened: boolean) => Promise<void>;
  }) => {
    audioControlsRef.current = controls;
  }, []);

  const unregisterAudioControls = useCallback(() => {
    audioControlsRef.current = null;
  }, []);

  // Enhanced toggle functions that use actual audio controls when available
  const toggleMute = useCallback(async () => {
    // Optimistic UI update first - update state immediately
    const newMutedState = !voiceState.isMuted;
    setVoiceState(prev => ({ ...prev, isMuted: newMutedState }));

    // Invalidate voice channel queries to refresh UI immediately
    queryClient.invalidateQueries({ queryKey: ['voice-channel'] });

    try {
      if (audioControlsRef.current?.toggleMute) {
        await audioControlsRef.current.toggleMute();
      }
      // If no audio controls, we're done - the UI update is sufficient
    } catch (error) {
      console.error('Failed to toggle mute:', error);
      // Revert UI state on failure
      setVoiceState(prev => ({ ...prev, isMuted: !newMutedState }));
      queryClient.invalidateQueries({ queryKey: ['voice-channel'] });
    }
  }, [voiceState.isMuted, queryClient]);

  const toggleDeafen = useCallback(async () => {
    // Optimistic UI update first - update state immediately
    const newDeafenedState = !voiceState.isDeafened;
    const newMutedState = newDeafenedState ? true : voiceState.isMuted;

    setVoiceState(prev => ({
      ...prev,
      isDeafened: newDeafenedState,
      isMuted: newMutedState
    }));

    // Invalidate voice channel queries to refresh UI immediately
    queryClient.invalidateQueries({ queryKey: ['voice-channel'] });

    try {
      if (audioControlsRef.current?.toggleDeafen) {
        await audioControlsRef.current.toggleDeafen();
      }
      // If no audio controls, we're done - the UI update is sufficient
    } catch (error) {
      console.error('Failed to toggle deafen:', error);
      // Revert UI state on failure
      setVoiceState(prev => ({
        ...prev,
        isDeafened: !newDeafenedState,
        isMuted: voiceState.isMuted // Restore original mute state
      }));
      queryClient.invalidateQueries({ queryKey: ['voice-channel'] });
    }
  }, [voiceState.isDeafened, voiceState.isMuted, queryClient]);

  const setMuted = useCallback(async (muted: boolean) => {
    // Optimistic UI update first - update state immediately
    setVoiceState(prev => ({ ...prev, isMuted: muted }));

    // Invalidate voice channel queries to refresh UI immediately
    queryClient.invalidateQueries({ queryKey: ['voice-channel'] });

    try {
      if (audioControlsRef.current?.setMuted) {
        await audioControlsRef.current.setMuted(muted);
      }
      // If no audio controls, we're done - the UI update is sufficient
    } catch (error) {
      console.error('Failed to set muted:', error);
      // Revert UI state on failure
      setVoiceState(prev => ({ ...prev, isMuted: !muted }));
      queryClient.invalidateQueries({ queryKey: ['voice-channel'] });
    }
  }, [queryClient]);

  const setDeafened = useCallback(async (deafened: boolean) => {
    // Optimistic UI update first - update state immediately
    const newMutedState = deafened ? true : voiceState.isMuted;

    setVoiceState(prev => ({
      ...prev,
      isDeafened: deafened,
      isMuted: newMutedState
    }));

    // Invalidate voice channel queries to refresh UI immediately
    queryClient.invalidateQueries({ queryKey: ['voice-channel'] });

    try {
      if (audioControlsRef.current?.setDeafened) {
        await audioControlsRef.current.setDeafened(deafened);
      }
      // If no audio controls, we're done - the UI update is sufficient
    } catch (error) {
      console.error('Failed to set deafened:', error);
      // Revert UI state on failure
      setVoiceState(prev => ({
        ...prev,
        isDeafened: !deafened,
        isMuted: voiceState.isMuted // Restore original mute state
      }));
      queryClient.invalidateQueries({ queryKey: ['voice-channel'] });
    }
  }, [voiceState.isMuted, queryClient]);

  const value: VoiceContextType = {
    voiceState,
    toggleMute,
    toggleDeafen,
    setMuted,
    setDeafened,
    setSpeaking,
    registerAudioControls,
    unregisterAudioControls,
    isConnectedToVoice,
    setIsConnectedToVoice,
  };

  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  );
}

// Re-export types and context from the types file
export type { VoiceState, VoiceContextType } from './VoiceContext';
export { VoiceContext } from './VoiceContext';

