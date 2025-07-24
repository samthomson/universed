import { useState, useCallback } from 'react';

export interface MentionData {
  pubkey: string;
  displayName: string;
  startIndex: number;
  endIndex: number;
}

export interface UseMentionsResult {
  mentions: MentionData[];
  currentMention: { query: string; startIndex: number } | null;
  insertMention: (pubkey: string, displayName: string) => void;
  updateMentions: (text: string, cursorPosition: number) => void;
  getMentionTags: () => string[][];
}

export function useUserMentions(
  text: string,
  setText: (text: string) => void,
  textareaRef: React.RefObject<HTMLTextAreaElement>
): UseMentionsResult {
  const [mentions, setMentions] = useState<MentionData[]>([]);
  const [currentMention, setCurrentMention] = useState<{ query: string; startIndex: number } | null>(null);

  // Update mentions when text changes
  const updateMentions = useCallback((newText: string, cursorPosition: number) => {
    // Find all existing mentions in the text
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const foundMentions: MentionData[] = [];
    let match;

    while ((match = mentionRegex.exec(newText)) !== null) {
      foundMentions.push({
        displayName: match[1],
        pubkey: match[2],
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }

    setMentions(foundMentions);

    // Check if cursor is after an @ symbol for autocomplete
    const textBeforeCursor = newText.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      // Check if this @ is part of an existing mention
      const isPartOfMention = foundMentions.some(mention =>
        lastAtIndex >= mention.startIndex && lastAtIndex < mention.endIndex
      );

      if (!isPartOfMention) {
        // Check if there's text after @ that could be a query
        const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
        const spaceIndex = textAfterAt.indexOf(' ');
        const newlineIndex = textAfterAt.indexOf('\n');

        // If there's no space or newline, or cursor is before them, we're in a mention
        if ((spaceIndex === -1 || cursorPosition <= lastAtIndex + 1 + spaceIndex) &&
            (newlineIndex === -1 || cursorPosition <= lastAtIndex + 1 + newlineIndex)) {

          const query = newText.slice(lastAtIndex + 1, cursorPosition);
          setCurrentMention({ query, startIndex: lastAtIndex });
          return;
        }
      }
    }

    setCurrentMention(null);
  }, []);

  // Insert a mention at the current position
  const insertMention = useCallback((pubkey: string, displayName: string) => {
    if (!currentMention || !textareaRef.current) return;

    const { startIndex } = currentMention;
    const textarea = textareaRef.current;
    const cursorPosition = textarea.selectionStart;

    // Replace the @query with the mention format
    const beforeMention = text.slice(0, startIndex);
    const afterMention = text.slice(cursorPosition);
    const mentionText = `@[${displayName}](${pubkey})`;

    const newText = beforeMention + mentionText + afterMention;
    setText(newText);

    // Set cursor position after the mention
    const newCursorPosition = startIndex + mentionText.length;

    // Update cursor position after React re-renders
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = newCursorPosition;
      textarea.focus();
    }, 0);

    setCurrentMention(null);
  }, [currentMention, text, setText, textareaRef]);

  // Get p tags for all mentions in the current text
  const getMentionTags = useCallback((): string[][] => {
    return mentions.map(mention => ['p', mention.pubkey]);
  }, [mentions]);

  return {
    mentions,
    currentMention,
    insertMention,
    updateMentions,
    getMentionTags
  };
}