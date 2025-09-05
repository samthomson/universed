import { useState, useCallback } from 'react';
import { nip19 } from 'nostr-tools';
import { logger } from '@/lib/logger';

export interface MentionData {
  pubkey: string;
  displayName: string;
  startIndex: number;
  endIndex: number;
}

interface MentionMapping {
  npub: string;
  pubkey: string;
  displayName: string;
}

export interface UseMentionsResult {
  mentions: MentionData[];
  currentMention: { query: string; startIndex: number } | null;
  insertMention: (pubkey: string, displayName: string) => void;
  updateMentions: (text: string, cursorPosition: number) => void;
  getMentionTags: () => string[][];
  getContentWithNpubs: (text: string) => string;
}

export function useUserMentions(
  text: string,
  setText: (text: string) => void,
  textareaRef: React.RefObject<HTMLTextAreaElement>
): UseMentionsResult {
  const [mentions, setMentions] = useState<MentionData[]>([]);
  const [currentMention, setCurrentMention] = useState<{ query: string; startIndex: number } | null>(null);
  const [mentionMappings, setMentionMappings] = useState<MentionMapping[]>([]);

  // Simple pass-through function kept for API compatibility
  // With our new approach, npubs are already directly inserted in the text
  const getContentWithNpubs = useCallback((text: string): string => text, []);

  // Update mentions when text changes
  const updateMentions = useCallback((newText: string, cursorPosition: number) => {
    const foundMentions: MentionData[] = [];
    const newMappings: MentionMapping[] = [];

    // Find npub patterns in the text
    const npubRegex = /npub1[023456789acdefghjklmnpqrstuvwxyz]{58}/g;
    let match;

    while ((match = npubRegex.exec(newText)) !== null) {
      const npub = match[0];
      
      // Find corresponding mapping or create a new one
      const mapping = mentionMappings.find(m => m.npub === npub);
      
      if (mapping) {
        foundMentions.push({
          displayName: mapping.displayName,
          pubkey: mapping.pubkey,
          startIndex: match.index,
          endIndex: match.index + npub.length
        });
        newMappings.push(mapping);
      } else {
        // Try to decode the npub to get the pubkey
        try {
          const decoded = nip19.decode(npub);
          const pubkey = typeof decoded.data === 'string' 
            ? decoded.data 
            : 'unknown';
          
          // Create a new mapping with a generic display name
          const displayName = "user";
          const newMapping: MentionMapping = {
            npub,
            pubkey,
            displayName
          };
          
          foundMentions.push({
            displayName,
            pubkey,
            startIndex: match.index,
            endIndex: match.index + npub.length
          });
          
          newMappings.push(newMapping);
        } catch (e) {
          logger.error('Failed to decode npub:', e);
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
  }, [mentionMappings]);

  // Insert a mention at the current position
  const insertMention = useCallback((npubOrPubkey: string, displayName: string) => {
    if (!currentMention || !textareaRef.current) return;

    const { startIndex } = currentMention;
    const textarea = textareaRef.current;
    const cursorPosition = textarea.selectionStart;

    // Replace the @query with the npub directly
    // Note: startIndex includes the @ symbol, so we replace from startIndex
    const beforeMention = text.slice(0, startIndex);
    const afterMention = text.slice(cursorPosition);
    
    // Determine if we received an npub or pubkey
    let npub: string;
    let pubkey: string;
    
    if (npubOrPubkey.startsWith('npub1')) {
      // Already an npub
      npub = npubOrPubkey;
      try {
        const decoded = nip19.decode(npub);
        pubkey = decoded.data as string;
      } catch (e) {
        logger.error('Failed to decode npub:', e);
        pubkey = npubOrPubkey; // Fallback
      }
    } else {
      // It's a pubkey, convert to npub
      pubkey = npubOrPubkey;
      npub = nip19.npubEncode(pubkey);
    }
    
    // Insert the npub directly into the text
    const newDisplayText = beforeMention + npub + afterMention;
    
    // Create a mapping for future reference
    const newMapping: MentionMapping = {
      npub,
      pubkey,
      displayName
    };

    // Update mappings
    setMentionMappings(prev => [...prev, newMapping]);

    // Set the display text
    setText(newDisplayText);

    // Set cursor position after the npub
    const newCursorPosition = startIndex + npub.length;

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
    getContentWithNpubs
  };
}