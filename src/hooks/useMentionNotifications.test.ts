import { renderHook } from '@testing-library/react';
import { useMentionNotifications } from './useMentionNotifications';
import { TestApp } from '@/test/TestApp';
import { describe, it, expect } from 'vitest';

describe('useMentionNotifications', () => {
  it('should be defined', () => {
    const { result } = renderHook(() => useMentionNotifications(), {
      wrapper: TestApp,
    });

    expect(result.current).toBeDefined();
    expect(result.current.mutate).toBeDefined();
    expect(result.current.isPending).toBeDefined();
    expect(result.current.isError).toBeDefined();
  });

  it('should have mutation properties', () => {
    const { result } = renderHook(() => useMentionNotifications(), {
      wrapper: TestApp,
    });

    expect(typeof result.current.mutate).toBe('function');
    expect(typeof result.current.mutateAsync).toBe('function');
    expect(typeof result.current.reset).toBe('function');
  });
});