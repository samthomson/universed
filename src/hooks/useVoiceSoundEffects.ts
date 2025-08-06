import { useCallback, useRef } from 'react';
import { useCurrentUser } from './useCurrentUser';

interface VoiceSoundEffectsOptions {
  enabled?: boolean;
  volume?: number;
}

/**
 * Hook to manage sound effects for voice channel events
 * Plays sounds when users join or leave voice channels
 */
export function useVoiceSoundEffects(options: VoiceSoundEffectsOptions = {}) {
  const { enabled = true, volume = 0.5 } = options;
  const { user } = useCurrentUser();

  // Refs to track recently played sounds to prevent stacking
  const joinSoundTimeoutRef = useRef<number | null>(null);
  const leaveSoundTimeoutRef = useRef<number | null>(null);
  const lastJoinTimeRef = useRef<number>(0);
  const lastLeaveTimeRef = useRef<number>(0);

  // Minimum time between sounds (in milliseconds) to prevent stacking
  const SOUND_COOLDOWN = 1000;

  // Preload audio elements
  const joinSoundRef = useRef<HTMLAudioElement | null>(null);
  const leaveSoundRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio elements
  const initializeSounds = useCallback(() => {
    if (!joinSoundRef.current) {
      joinSoundRef.current = new Audio('/sounds/join-voice.mp3');
      joinSoundRef.current.volume = volume;
      joinSoundRef.current.preload = 'auto';
    }

    if (!leaveSoundRef.current) {
      leaveSoundRef.current = new Audio('/sounds/leave-voice.mp3');
      leaveSoundRef.current.volume = volume;
      leaveSoundRef.current.preload = 'auto';
    }
  }, [volume]);

  // Play join sound for other users (not the current user)
  const playJoinSound = useCallback((pubkey: string) => {
    if (!enabled || !user?.pubkey || pubkey === user.pubkey) {
      return;
    }

    const now = Date.now();
    const timeSinceLastJoin = now - lastJoinTimeRef.current;

    // Check if we're in cooldown period
    if (timeSinceLastJoin < SOUND_COOLDOWN) {
      return;
    }

    // Clear any pending timeout
    if (joinSoundTimeoutRef.current) {
      clearTimeout(joinSoundTimeoutRef.current);
      joinSoundTimeoutRef.current = null;
    }

    // Initialize sounds if not already done
    initializeSounds();

    // Set a small delay to prevent rapid successive sounds
    joinSoundTimeoutRef.current = window.setTimeout(() => {
      if (joinSoundRef.current) {
        // Clone the audio element to allow overlapping sounds if needed
        const sound = joinSoundRef.current.cloneNode(true) as HTMLAudioElement;
        sound.volume = volume;
        
        // Play the sound
        sound.play().catch((error) => {
          console.warn('Failed to play join sound:', error);
        });

        // Clean up the cloned audio element after it finishes
        sound.onended = () => {
          sound.remove();
        };
      }

      lastJoinTimeRef.current = Date.now();
      joinSoundTimeoutRef.current = null;
    }, 100); // Small delay to prevent stacking
  }, [enabled, user?.pubkey, volume, initializeSounds]);

  // Play leave sound for other users (not the current user)
  const playLeaveSound = useCallback((pubkey: string) => {
    if (!enabled || !user?.pubkey || pubkey === user.pubkey) {
      return;
    }

    const now = Date.now();
    const timeSinceLastLeave = now - lastLeaveTimeRef.current;

    // Check if we're in cooldown period
    if (timeSinceLastLeave < SOUND_COOLDOWN) {
      return;
    }

    // Clear any pending timeout
    if (leaveSoundTimeoutRef.current) {
      clearTimeout(leaveSoundTimeoutRef.current);
      leaveSoundTimeoutRef.current = null;
    }

    // Initialize sounds if not already done
    initializeSounds();

    // Set a small delay to prevent rapid successive sounds
    leaveSoundTimeoutRef.current = window.setTimeout(() => {
      if (leaveSoundRef.current) {
        // Clone the audio element to allow overlapping sounds if needed
        const sound = leaveSoundRef.current.cloneNode(true) as HTMLAudioElement;
        sound.volume = volume;
        
        // Play the sound
        sound.play().catch((error) => {
          console.warn('Failed to play leave sound:', error);
        });

        // Clean up the cloned audio element after it finishes
        sound.onended = () => {
          sound.remove();
        };
      }

      lastLeaveTimeRef.current = Date.now();
      leaveSoundTimeoutRef.current = null;
    }, 100); // Small delay to prevent stacking
  }, [enabled, user?.pubkey, volume, initializeSounds]);

  // Update volume
  const setVolume = useCallback((newVolume: number) => {
    if (joinSoundRef.current) {
      joinSoundRef.current.volume = newVolume;
    }
    if (leaveSoundRef.current) {
      leaveSoundRef.current.volume = newVolume;
    }
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (joinSoundTimeoutRef.current) {
      clearTimeout(joinSoundTimeoutRef.current);
      joinSoundTimeoutRef.current = null;
    }
    if (leaveSoundTimeoutRef.current) {
      clearTimeout(leaveSoundTimeoutRef.current);
      leaveSoundTimeoutRef.current = null;
    }

    // Clean up audio elements
    if (joinSoundRef.current) {
      joinSoundRef.current.pause();
      joinSoundRef.current.src = '';
      joinSoundRef.current = null;
    }
    if (leaveSoundRef.current) {
      leaveSoundRef.current.pause();
      leaveSoundRef.current.src = '';
      leaveSoundRef.current = null;
    }
  }, []);

  return {
    playJoinSound,
    playLeaveSound,
    setVolume,
    cleanup,
  };
}