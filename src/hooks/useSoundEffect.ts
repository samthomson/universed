import { useCallback } from 'react';

export function useSoundEffect() {
  const playSound = useCallback((soundPath: string, volume: number = 0.5) => {
    try {
      // Create new audio element for each play to allow overlapping sounds
      const audio = new Audio(soundPath);
      audio.volume = volume;

      // Play the sound
      const playPromise = audio.play();

      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn('Audio playback failed:', error);
        });
      }

      return audio;
    } catch (error) {
      console.warn('Failed to create audio element:', error);
      return null;
    }
  }, []);

  return { playSound };
}