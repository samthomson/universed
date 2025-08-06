import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface VoiceState {
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
}

interface VoiceContextType {
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

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

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