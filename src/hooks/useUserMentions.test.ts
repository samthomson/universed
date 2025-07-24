import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUserMentions } from './useUserMentions';

describe('useUserMentions', () => {
  it('should detect mention query when typing @', () => {
    const setText = vi.fn();
    const textareaRef = { current: null };

    const { result } = renderHook(() => useUserMentions('', setText, textareaRef));

    act(() => {
      result.current.updateMentions('Hello @john', 11);
    });

    expect(result.current.currentMention).toEqual({
      query: 'john',
      startIndex: 6
    });
  });

  it('should clear mention when space is typed', () => {
    const setText = vi.fn();
    const textareaRef = { current: null };

    const { result } = renderHook(() => useUserMentions('', setText, textareaRef));

    act(() => {
      result.current.updateMentions('Hello @john ', 12);
    });

    expect(result.current.currentMention).toBeNull();
  });

  it('should extract p tags from mentions', () => {
    const setText = vi.fn();
    const textareaRef = { current: null };

    const { result } = renderHook(() => useUserMentions('Hello @[John] and @[Jane]', setText, textareaRef));

    act(() => {
      result.current.updateMentions('Hello @[John](pubkey123) and @[Jane](pubkey456)', 0);
    });

    const tags = result.current.getMentionTags();
    expect(tags).toEqual([
      ['p', 'pubkey123'],
      ['p', 'pubkey456']
    ]);
  });

  it('should convert display text to full text with pubkeys', () => {
    const setText = vi.fn();
    const textareaRef = { current: null };

    const { result } = renderHook(() => useUserMentions('Hello @[John]', setText, textareaRef));

    // First, process full text to create mappings
    act(() => {
      result.current.updateMentions('Hello @[John](pubkey123)', 0);
    });

    // Then test conversion
    const fullText = result.current.getFullTextWithPubkeys('Hello @[John] how are you?');
    expect(fullText).toBe('Hello @[John](pubkey123) how are you?');
  });
});