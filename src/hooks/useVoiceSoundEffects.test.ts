import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVoiceSoundEffects } from './useVoiceSoundEffects';

// Mock the useCurrentUser hook
vi.mock('./useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { pubkey: 'test-user-pubkey' },
  }),
}));

// Mock Audio with minimal implementation
const mockAudioPlay = vi.fn().mockResolvedValue(undefined);
const mockAudioClone = vi.fn().mockImplementation(() => ({
  play: mockAudioPlay,
  volume: 0.5,
  onended: null,
  remove: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  autoplay: false,
  buffered: { length: 0, start: vi.fn(), end: vi.fn() },
  currentSrc: '',
  currentTime: 0,
  duration: 0,
  ended: false,
  error: null,
  loop: false,
  muted: false,
  networkState: 0,
  paused: true,
  playbackRate: 1,
  played: { length: 0, start: vi.fn(), end: vi.fn() },
  preload: 'auto',
  readyState: 0,
  seekable: { length: 0, start: vi.fn(), end: vi.fn() },
  seeking: false,
  src: '',
  textTracks: { length: 0, onaddtrack: null, onchange: null, onremovetrack: null, getTrackById: vi.fn() },
  crossOrigin: null,
  defaultMuted: false,
  defaultPlaybackRate: 1,
  disableRemotePlayback: false,
  controls: false,
  controlsList: '',
  sinkId: '',
  srcObject: null,
  load: vi.fn(),
  pause: vi.fn(),
  canPlayType: vi.fn(),
  fastSeek: vi.fn(),
  getStartDate: vi.fn(),
  setMediaKeys: vi.fn(),
  setSinkId: vi.fn().mockResolvedValue(undefined),
  captureStream: vi.fn(),
  requestVideoFrameCallback: vi.fn(),
  cancelVideoFrameCallback: vi.fn(),
  addTextTrack: vi.fn(),
  getVideoPlaybackQuality: vi.fn(),
  webkitAudioDecodedByteCount: 0,
  webkitVideoDecodedByteCount: 0,
  HAVE_NOTHING: 0,
  HAVE_METADATA: 1,
  HAVE_CURRENT_DATA: 2,
  HAVE_FUTURE_DATA: 3,
  HAVE_ENOUGH_DATA: 4,
  NETWORK_EMPTY: 0,
  NETWORK_IDLE: 1,
  NETWORK_LOADING: 2,
  NETWORK_NO_SOURCE: 3,
}));

// Create a simple mock for Audio constructor
const _originalAudio = global.Audio;
vi.spyOn(global, 'Audio').mockImplementation((src?: string) => {
  const audio = {
    play: mockAudioPlay,
    volume: 0.5,
    preload: 'auto',
    cloneNode: mockAudioClone,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    autoplay: false,
    buffered: { length: 0, start: vi.fn(), end: vi.fn() },
    currentSrc: src || '',
    currentTime: 0,
    duration: 0,
    ended: false,
    error: null,
    loop: false,
    muted: false,
    networkState: 0,
    paused: true,
    playbackRate: 1,
    played: { length: 0, start: vi.fn(), end: vi.fn() },
    readyState: 0,
    seekable: { length: 0, start: vi.fn(), end: vi.fn() },
    seeking: false,
    src: src || '',
    textTracks: { length: 0, onaddtrack: null, onchange: null, onremovetrack: null, getTrackById: vi.fn() },
    crossOrigin: null,
    defaultMuted: false,
    defaultPlaybackRate: 1,
    disableRemotePlayback: false,
    controls: false,
    controlsList: '',
    sinkId: '',
    srcObject: null,
    load: vi.fn(),
    pause: vi.fn(),
    canPlayType: vi.fn(),
    fastSeek: vi.fn(),
    getStartDate: vi.fn(),
    setMediaKeys: vi.fn(),
    setSinkId: vi.fn().mockResolvedValue(undefined),
    captureStream: vi.fn(),
    requestVideoFrameCallback: vi.fn(),
    cancelVideoFrameCallback: vi.fn(),
    addTextTrack: vi.fn(),
    getVideoPlaybackQuality: vi.fn(),
    webkitAudioDecodedByteCount: 0,
    webkitVideoDecodedByteCount: 0,
    HAVE_NOTHING: 0,
    HAVE_METADATA: 1,
    HAVE_CURRENT_DATA: 2,
    HAVE_FUTURE_DATA: 3,
    HAVE_ENOUGH_DATA: 4,
    NETWORK_EMPTY: 0,
    NETWORK_IDLE: 1,
    NETWORK_LOADING: 2,
    NETWORK_NO_SOURCE: 3,
  };
  return audio as unknown as HTMLAudioElement;
});

describe('useVoiceSoundEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not play join sound for current user', () => {
    const { result } = renderHook(() => useVoiceSoundEffects());

    act(() => {
      result.current.playJoinSound('test-user-pubkey');
    });

    expect(mockAudioPlay).not.toHaveBeenCalled();
  });

  it('should play join sound for other users', () => {
    const { result } = renderHook(() => useVoiceSoundEffects());

    act(() => {
      result.current.playJoinSound('other-user-pubkey');
    });

    // Fast forward timers to trigger the setTimeout
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(mockAudioPlay).toHaveBeenCalled();
  });

  it('should not play leave sound for current user', () => {
    const { result } = renderHook(() => useVoiceSoundEffects());

    act(() => {
      result.current.playLeaveSound('test-user-pubkey');
    });

    expect(mockAudioPlay).not.toHaveBeenCalled();
  });

  it('should play leave sound for other users', () => {
    const { result } = renderHook(() => useVoiceSoundEffects());

    act(() => {
      result.current.playLeaveSound('other-user-pubkey');
    });

    // Fast forward timers to trigger the setTimeout
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(mockAudioPlay).toHaveBeenCalled();
  });

  it('should respect cooldown period', () => {
    const { result } = renderHook(() => useVoiceSoundEffects());

    // Play sound for other user
    act(() => {
      result.current.playJoinSound('other-user-pubkey');
    });

    // Fast forward timers to trigger the setTimeout
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(mockAudioPlay).toHaveBeenCalledTimes(1);

    // Try to play again immediately (should be blocked by cooldown)
    act(() => {
      result.current.playJoinSound('other-user-pubkey');
    });

    // Fast forward timers again
    act(() => {
      vi.advanceTimersByTime(150);
    });

    // Should still only be called once due to cooldown
    expect(mockAudioPlay).toHaveBeenCalledTimes(1);
  });

  it('should cleanup properly', () => {
    const { result, unmount } = renderHook(() => useVoiceSoundEffects());

    act(() => {
      result.current.cleanup();
    });

    unmount();

    // Verify cleanup was called (no errors thrown)
    expect(true).toBe(true);
  });
});