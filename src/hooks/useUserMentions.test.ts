import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUserMentions } from './useUserMentions';
import { nip19 } from 'nostr-tools';

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

    // Simulate inserting mentions to create mappings
    act(() => {
      result.current.updateMentions('Hello @[John] and @[Jane]', 0);
    });

    const tags = result.current.getMentionTags();
    expect(tags).toEqual([]);
  });

  it('should convert display text to content with npubs', () => {
    const setText = vi.fn();
    const textareaRef = { 
      current: { 
        selectionStart: 0, 
        selectionEnd: 0, 
        focus: vi.fn() 
      } as unknown as HTMLTextAreaElement
    };

    const { result } = renderHook(() => useUserMentions('Hello @john', setText, textareaRef));

    // Simulate inserting a mention
    act(() => {
      result.current.updateMentions('Hello @john', 11);
    });

    // Insert the mention
    act(() => {
      result.current.insertMention('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', 'John');
    });

    // Test conversion to npub format
    const content = result.current.getContentWithNpubs('Hello @[John] how are you?');
    const expectedNpub = nip19.npubEncode('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
    expect(content).toBe(`Hello ${expectedNpub} how are you?`);
  });
});