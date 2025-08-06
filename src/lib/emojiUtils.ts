import emojilib from 'emojilib';

// Create emoji data from the standard library
const standardEmojis = Object.entries(emojilib).map(([emoji, keywords]) => ({
  emoji,
  shortcodes: Array.isArray(keywords) ? keywords : [keywords]
}));

// Add Bitcoin and Nostr specific emojis
const customEmojis = [
  { emoji: '₿', shortcodes: ['bitcoin', 'btc'] },
  { emoji: '⚡', shortcodes: ['lightning', 'ln', 'zap'] },
  { emoji: '🟣', shortcodes: ['nostr', 'decentralized'] },
];

// Combine standard emojis with custom ones
const allEmojis = [...standardEmojis, ...customEmojis];

export interface EmojiData {
  emoji: string;
  shortcodes: string[];
}

// Create a searchable map from our emoji data
const allShortcodes = new Map<string, EmojiData>();
allEmojis.forEach(emojiData => {
  emojiData.shortcodes.forEach(shortcode => {
    allShortcodes.set(shortcode, emojiData);
  });
});

/**
 * Search for emojis by shortcode prefix
 */
export function searchEmojis(query: string, limit = 8): EmojiData[] {
  if (!query) return [];
  
  const normalizedQuery = query.toLowerCase();
  const results: EmojiData[] = [];
  const seen = new Set<string>();
  
  // Search through all shortcodes
  for (const [shortcode, emojiData] of allShortcodes) {
    if (results.length >= limit) break;
    
    if (shortcode.startsWith(normalizedQuery) && !seen.has(emojiData.emoji)) {
      results.push(emojiData);
      seen.add(emojiData.emoji);
    }
  }
  
  return results;
}

/**
 * Get emoji by exact shortcode
 */
export function getEmojiByShortcode(shortcode: string): EmojiData | undefined {
  return allShortcodes.get(shortcode);
}

/**
 * Extract shortcode context from cursor position
 */
export function extractShortcodeContext(text: string, cursorPosition: number): {
  query: string;
  startIndex: number;
  endIndex: number;
} | null {
  // Look backwards from cursor to find ':'
  let startIndex = -1;
  for (let i = cursorPosition - 1; i >= 0; i--) {
    const char = text[i];
    if (char === ':') {
      startIndex = i;
      break;
    }
    // Stop if we hit whitespace or another special character
    if (char === ' ' || char === '\n' || char === '\t') {
      break;
    }
  }
  
  if (startIndex === -1) return null;
  
  // Extract the query from after the ':' to the cursor
  const query = text.slice(startIndex + 1, cursorPosition);
  
  // Only show autocomplete if query is alphanumeric/underscore/dash/plus (valid shortcode chars)
  if (!/^[a-zA-Z0-9_+-]*$/.test(query)) return null;
  
  return {
    query,
    startIndex,
    endIndex: cursorPosition,
  };
}

// Test function to verify the logic works
export function testEmojiInsertion() {
  const text = "Hello :smile";
  const cursorPos = text.length;
  const context = extractShortcodeContext(text, cursorPos);
  
  if (context) {
    const emoji = getEmojiByShortcode('smile');
    if (emoji) {
      const newText = text.slice(0, context.startIndex) + emoji.emoji + text.slice(context.endIndex);
      console.log('Test result:', newText); // Should be "Hello 😄"
      return newText;
    }
  }
  return text;
}