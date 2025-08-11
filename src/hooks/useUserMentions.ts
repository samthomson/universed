import { useState, useCallback } from 'react';

export interface MentionData {
  pubkey: string;
  displayName: string;
  startIndex: number;
  endIndex: number;
}

interface MentionMapping {
  displayText: string;
  fullText: string;
  pubkey: string;
  displayName: string;
}

export interface UseMentionsResult {
  mentions: MentionData[];
  currentMention: { query: string; startIndex: number } | null;
  insertMention: (pubkey: string, displayName: string) => void;
  updateMentions: (text: string, cursorPosition: number) => void;
  getMentionTags: () => string[][];
  getFullTextWithPubkeys: (displayText: string) => string;
}

export function useUserMentions(
  text: string,
  setText: (text: string) => void,
  textareaRef: React.RefObject<HTMLTextAreaElement>
): UseMentionsResult {
  const [mentions, setMentions] = useState<MentionData[]>([]);
  const [currentMention, setCurrentMention] = useState<{ query: string; startIndex: number } | null>(null);
  const [mentionMappings, setMentionMappings] = useState<MentionMapping[]>([]);

  // Convert display text (with @[Name]) to full text (with @[Name](pubkey))
  const getFullTextWithPubkeys = useCallback((displayText: string): string => {
    let fullText = displayText;

    // Replace each @[Name] with @[Name](pubkey) using our mappings
    mentionMappings.forEach(mapping => {
      fullText = fullText.replace(mapping.displayText, mapping.fullText);
    });

    return fullText;
  }, [mentionMappings]);

  // Convert full text (with pubkeys) to display text (without pubkeys)
  const getDisplayText = useCallback((fullText: string): string => {
    let displayText = fullText;

    // Replace @[Name](pubkey) with @[Name]
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    displayText = displayText.replace(mentionRegex, '@[$1]');

    return displayText;
  }, []);

  // Update mentions when text changes
  const updateMentions = useCallback((newText: string, cursorPosition: number) => {
    // Check if this is display text (without pubkeys) or full text (with pubkeys)
    const hasFullMentions = /@\[([^\]]+)\]\(([^)]+)\)/.test(newText);

    let workingText = newText;
    const foundMentions: MentionData[] = [];
    const newMappings: MentionMapping[] = [];

    if (hasFullMentions) {
      // This is full text with pubkeys - extract mentions and create mappings
      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
      let match;

      while ((match = mentionRegex.exec(newText)) !== null) {
        const displayName = match[1];
        const pubkey = match[2];
        const displayText = `@[${displayName}]`;
        const fullText = match[0];

        foundMentions.push({
          displayName,
          pubkey,
          startIndex: match.index,
          endIndex: match.index + match[0].length
        });

        newMappings.push({
          displayText,
          fullText,
          pubkey,
          displayName
        });
      }

      // Convert to display text for the UI
      workingText = getDisplayText(newText);

      // Update the text in the UI if it's different
      if (workingText !== newText) {
        setText(workingText);
      }
    } else {
      // This is display text - find @[Name] patterns and match with existing mappings
      const displayMentionRegex = /@\[([^\]]+)\]/g;
      let match;

      while ((match = displayMentionRegex.exec(workingText)) !== null) {
        const displayName = match[1];

        // Find corresponding mapping
        const mapping = mentionMappings.find(m => m.displayName === displayName);
        if (mapping) {
          foundMentions.push({
            displayName,
            pubkey: mapping.pubkey,
            startIndex: match.index,
            endIndex: match.index + match[0].length
          });
          newMappings.push(mapping);
        }
      }
    }

    setMentions(foundMentions);
    setMentionMappings(newMappings);

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
  }, [mentionMappings, getDisplayText, setText]);

  // Insert a mention at the current position
  const insertMention = useCallback((pubkey: string, displayName: string) => {
    if (!currentMention || !textareaRef.current) return;

    const { startIndex } = currentMention;
    const textarea = textareaRef.current;
    const cursorPosition = textarea.selectionStart;

    // Replace the @query with the display mention format
    // Note: startIndex includes the @ symbol, so we replace from startIndex
    const beforeMention = text.slice(0, startIndex);
    const afterMention = text.slice(cursorPosition);
    const displayMentionText = `@[${displayName}]`; // Include @ in display text
    const fullMentionText = `@[${displayName}](${pubkey})`;

    const newDisplayText = beforeMention + displayMentionText + afterMention;

    // Create new mapping
    const newMapping: MentionMapping = {
      displayText: displayMentionText,
      fullText: fullMentionText,
      pubkey,
      displayName
    };

    // Update mappings
    setMentionMappings(prev => [...prev, newMapping]);

    // Set the display text
    setText(newDisplayText);

    // Set cursor position after the mention
    const newCursorPosition = startIndex + displayMentionText.length;

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
    getMentionTags,
    getFullTextWithPubkeys
  };
}