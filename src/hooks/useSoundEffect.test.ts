import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSoundEffect } from './useSoundEffect';

// Test the sound effect hook logic
describe('useSoundEffect', () => {
  it('should return a playSound function', () => {
    const { result } = renderHook(() => useSoundEffect());
    const { playSound } = result.current;
    expect(typeof playSound).toBe('function');
  });

  it('should accept sound path and volume parameters', () => {
    const { result } = renderHook(() => useSoundEffect());
    const { playSound } = result.current;

    // Test that the function can be called with expected parameters
    expect(() => {
      // Mock Audio to avoid actual audio creation in tests
      const OriginalAudio = global.Audio;
      global.Audio = class {
        volume = 0.7;
        play() {
          return Promise.resolve();
        }
      } as unknown as typeof Audio;

      try {
        playSound('/test-sound.mp3', 0.7);
      } finally {
        global.Audio = OriginalAudio;
      }
    }).not.toThrow();
  });

  it('should work with default volume', () => {
    const { result } = renderHook(() => useSoundEffect());
    const { playSound } = result.current;

    expect(() => {
      const OriginalAudio = global.Audio;
      global.Audio = class {
        volume = 0.5;
        play() {
          return Promise.resolve();
        }
      } as unknown as typeof Audio;

      try {
        playSound('/test-sound.mp3');
      } finally {
        global.Audio = OriginalAudio;
      }
    }).not.toThrow();
  });

  it('should handle different volume levels', () => {
    const { result } = renderHook(() => useSoundEffect());
    const { playSound } = result.current;

    expect(() => {
      const OriginalAudio = global.Audio;
      global.Audio = class {
        volume = 0.5;
        play() {
          return Promise.resolve();
        }
      } as unknown as typeof Audio;

      try {
        playSound('/test-sound.mp3', 0);
        playSound('/test-sound.mp3', 0.5);
        playSound('/test-sound.mp3', 1);
      } finally {
        global.Audio = OriginalAudio;
      }
    }).not.toThrow();
  });
});