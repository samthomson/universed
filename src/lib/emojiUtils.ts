// Common emojis with Bitcoin/Nostr additions
const commonEmojis = [
  // Faces and emotions
  { emoji: '😀', shortcodes: ['grinning', 'smile'] },
  { emoji: '😃', shortcodes: ['smiley', 'happy'] },
  { emoji: '😄', shortcodes: ['smile', 'joy'] },
  { emoji: '😁', shortcodes: ['grin'] },
  { emoji: '😆', shortcodes: ['laughing', 'satisfied'] },
  { emoji: '😅', shortcodes: ['sweat_smile'] },
  { emoji: '🤣', shortcodes: ['rofl', 'rolling'] },
  { emoji: '😂', shortcodes: ['joy', 'tears'] },
  { emoji: '🙂', shortcodes: ['slightly_smiling'] },
  { emoji: '🙃', shortcodes: ['upside_down'] },
  { emoji: '😉', shortcodes: ['wink'] },
  { emoji: '😊', shortcodes: ['blush'] },
  { emoji: '😇', shortcodes: ['innocent'] },
  { emoji: '🥰', shortcodes: ['heart_eyes', 'love'] },
  { emoji: '😍', shortcodes: ['heart_eyes'] },
  { emoji: '🤩', shortcodes: ['star_struck'] },
  { emoji: '😘', shortcodes: ['kissing_heart'] },
  { emoji: '😗', shortcodes: ['kissing'] },
  { emoji: '😚', shortcodes: ['kissing_closed_eyes'] },
  { emoji: '😙', shortcodes: ['kissing_smiling_eyes'] },
  { emoji: '😋', shortcodes: ['yum'] },
  { emoji: '😛', shortcodes: ['stuck_out_tongue'] },
  { emoji: '😜', shortcodes: ['stuck_out_tongue_winking_eye'] },
  { emoji: '🤪', shortcodes: ['zany'] },
  { emoji: '😝', shortcodes: ['stuck_out_tongue_closed_eyes'] },
  { emoji: '🤑', shortcodes: ['money_mouth'] },
  { emoji: '🤗', shortcodes: ['hugging'] },
  { emoji: '🤭', shortcodes: ['hand_over_mouth'] },
  { emoji: '🤫', shortcodes: ['shush'] },
  { emoji: '🤔', shortcodes: ['thinking'] },
  { emoji: '🤐', shortcodes: ['zipper_mouth'] },
  { emoji: '🤨', shortcodes: ['raised_eyebrow'] },
  { emoji: '😐', shortcodes: ['neutral'] },
  { emoji: '😑', shortcodes: ['expressionless'] },
  { emoji: '😶', shortcodes: ['no_mouth'] },
  { emoji: '😏', shortcodes: ['smirk'] },
  { emoji: '😒', shortcodes: ['unamused'] },
  { emoji: '🙄', shortcodes: ['eye_roll'] },
  { emoji: '😬', shortcodes: ['grimacing'] },
  { emoji: '🤥', shortcodes: ['lying'] },
  { emoji: '😔', shortcodes: ['pensive'] },
  { emoji: '😪', shortcodes: ['sleepy'] },
  { emoji: '🤤', shortcodes: ['drooling'] },
  { emoji: '😴', shortcodes: ['sleeping'] },
  { emoji: '😷', shortcodes: ['mask'] },
  { emoji: '🤒', shortcodes: ['sick'] },
  { emoji: '🤕', shortcodes: ['injured'] },
  { emoji: '🤢', shortcodes: ['nauseated'] },
  { emoji: '🤮', shortcodes: ['vomiting'] },
  { emoji: '🤧', shortcodes: ['sneezing'] },
  { emoji: '🥵', shortcodes: ['hot'] },
  { emoji: '🥶', shortcodes: ['cold'] },
  { emoji: '🥴', shortcodes: ['woozy'] },
  { emoji: '😵', shortcodes: ['dizzy'] },
  { emoji: '🤯', shortcodes: ['exploding_head'] },
  { emoji: '🤠', shortcodes: ['cowboy'] },
  { emoji: '🥳', shortcodes: ['party'] },
  { emoji: '😎', shortcodes: ['sunglasses', 'cool'] },
  { emoji: '🤓', shortcodes: ['nerd'] },
  { emoji: '🧐', shortcodes: ['monocle'] },
  
  // Negative emotions
  { emoji: '😕', shortcodes: ['confused'] },
  { emoji: '😟', shortcodes: ['worried'] },
  { emoji: '🙁', shortcodes: ['frowning'] },
  { emoji: '☹️', shortcodes: ['frowning2'] },
  { emoji: '😮', shortcodes: ['open_mouth'] },
  { emoji: '😯', shortcodes: ['hushed'] },
  { emoji: '😲', shortcodes: ['astonished'] },
  { emoji: '😳', shortcodes: ['flushed'] },
  { emoji: '🥺', shortcodes: ['pleading'] },
  { emoji: '😦', shortcodes: ['frowning_open'] },
  { emoji: '😧', shortcodes: ['anguished'] },
  { emoji: '😨', shortcodes: ['fearful'] },
  { emoji: '😰', shortcodes: ['cold_sweat'] },
  { emoji: '😥', shortcodes: ['disappointed_relieved'] },
  { emoji: '😢', shortcodes: ['cry'] },
  { emoji: '😭', shortcodes: ['sob'] },
  { emoji: '😱', shortcodes: ['scream'] },
  { emoji: '😖', shortcodes: ['confounded'] },
  { emoji: '😣', shortcodes: ['persevere'] },
  { emoji: '😞', shortcodes: ['disappointed'] },
  { emoji: '😓', shortcodes: ['sweat'] },
  { emoji: '😩', shortcodes: ['weary'] },
  { emoji: '😫', shortcodes: ['tired'] },
  { emoji: '🥱', shortcodes: ['yawning'] },
  { emoji: '😤', shortcodes: ['triumph'] },
  { emoji: '😡', shortcodes: ['rage'] },
  { emoji: '😠', shortcodes: ['angry'] },
  { emoji: '🤬', shortcodes: ['swearing'] },

  // Hearts and love
  { emoji: '❤️', shortcodes: ['heart', 'love'] },
  { emoji: '🧡', shortcodes: ['orange_heart'] },
  { emoji: '💛', shortcodes: ['yellow_heart'] },
  { emoji: '💚', shortcodes: ['green_heart'] },
  { emoji: '💙', shortcodes: ['blue_heart'] },
  { emoji: '💜', shortcodes: ['purple_heart'] },
  { emoji: '🖤', shortcodes: ['black_heart'] },
  { emoji: '🤍', shortcodes: ['white_heart'] },
  { emoji: '🤎', shortcodes: ['brown_heart'] },
  { emoji: '💔', shortcodes: ['broken_heart'] },
  { emoji: '❣️', shortcodes: ['heart_exclamation'] },
  { emoji: '💕', shortcodes: ['two_hearts'] },
  { emoji: '💞', shortcodes: ['revolving_hearts'] },
  { emoji: '💓', shortcodes: ['heartbeat'] },
  { emoji: '💗', shortcodes: ['growing_heart'] },
  { emoji: '💖', shortcodes: ['sparkling_heart'] },
  { emoji: '💘', shortcodes: ['cupid'] },
  { emoji: '💝', shortcodes: ['gift_heart'] },
  { emoji: '💟', shortcodes: ['heart_decoration'] },

  // Hand gestures
  { emoji: '👍', shortcodes: ['thumbsup', 'like', 'yes'] },
  { emoji: '👎', shortcodes: ['thumbsdown', 'dislike', 'no'] },
  { emoji: '👌', shortcodes: ['ok_hand'] },
  { emoji: '✌️', shortcodes: ['peace_sign', 'v'] },
  { emoji: '🤞', shortcodes: ['fingers_crossed'] },
  { emoji: '🤟', shortcodes: ['love_you'] },
  { emoji: '🤘', shortcodes: ['rock', 'metal'] },
  { emoji: '🤙', shortcodes: ['call_me'] },
  { emoji: '👈', shortcodes: ['point_left'] },
  { emoji: '👉', shortcodes: ['point_right'] },
  { emoji: '👆', shortcodes: ['point_up'] },
  { emoji: '🖕', shortcodes: ['middle_finger', 'fu'] },
  { emoji: '👇', shortcodes: ['point_down'] },
  { emoji: '☝️', shortcodes: ['point_up_2'] },
  { emoji: '👏', shortcodes: ['clap'] },
  { emoji: '🙌', shortcodes: ['raised_hands'] },
  { emoji: '👐', shortcodes: ['open_hands'] },
  { emoji: '🤲', shortcodes: ['palms_up'] },
  { emoji: '🤝', shortcodes: ['handshake'] },
  { emoji: '🙏', shortcodes: ['pray', 'thanks'] },
  { emoji: '✍️', shortcodes: ['writing'] },
  { emoji: '💅', shortcodes: ['nail_care'] },
  { emoji: '🤳', shortcodes: ['selfie'] },
  { emoji: '💪', shortcodes: ['muscle', 'strong'] },

  // Popular symbols and objects
  { emoji: '🔥', shortcodes: ['fire', 'lit'] },
  { emoji: '💯', shortcodes: ['100', 'hundred'] },
  { emoji: '✨', shortcodes: ['sparkles'] },
  { emoji: '⭐', shortcodes: ['star'] },
  { emoji: '🌟', shortcodes: ['star2'] },
  { emoji: '💫', shortcodes: ['dizzy_star'] },
  { emoji: '☄️', shortcodes: ['comet'] },
  { emoji: '💥', shortcodes: ['boom'] },

  // Bitcoin and Nostr emojis
  { emoji: '₿', shortcodes: ['bitcoin', 'btc'] },
  { emoji: '⚡', shortcodes: ['lightning', 'ln', 'zap'] },
  { emoji: '🟣', shortcodes: ['nostr', 'decentralized'] },
  { emoji: '🔑', shortcodes: ['key', 'private_key', 'keys'] },
  { emoji: '🛡️', shortcodes: ['shield', 'security', 'privacy'] },
  { emoji: '🌐', shortcodes: ['globe', 'internet', 'web'] },
  { emoji: '📡', shortcodes: ['satellite', 'relay', 'broadcast'] },
  { emoji: '🔗', shortcodes: ['link', 'chain', 'blockchain'] },
  { emoji: '💎', shortcodes: ['diamond', 'diamond_hands', 'hodl'] },
  { emoji: '🚀', shortcodes: ['rocket', 'moon', 'to_the_moon'] },
];

export interface EmojiData {
  emoji: string;
  shortcodes: string[];
}

// Create a searchable map from our emoji data
const allShortcodes = new Map<string, EmojiData>();
commonEmojis.forEach(emojiData => {
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