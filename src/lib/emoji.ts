import emojiRegex from 'emoji-regex';

/**
 * Extract emojis from text
 */
export function extractEmojis(text: string): string[] {
  const regex = emojiRegex();
  const matches = text.match(regex);
  return matches || [];
}

/**
 * Check if a string contains only emojis (and whitespace)
 */
export function isOnlyEmojis(text: string): boolean {
  const regex = emojiRegex();
  const withoutEmojis = text.replace(regex, '').trim();
  return withoutEmojis === '';
}

/**
 * Count emojis in text
 */
export function countEmojis(text: string): number {
  const regex = emojiRegex();
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

/**
 * Replace emoji shortcodes with actual emojis
 * This is a basic implementation - you might want to use a more comprehensive library
 */
export function replaceShortcodes(text: string): string {
  const shortcodes: Record<string, string> = {
    ':)': '😊',
    ':-)': '😊',
    ':(': '😢',
    ':-(': '😢',
    ':D': '😃',
    ':-D': '😃',
    ':P': '😛',
    ':-P': '😛',
    ';)': '😉',
    ';-)': '😉',
    ':o': '😮',
    ':-o': '😮',
    '<3': '❤️',
    '</3': '💔',
    ':thumbsup:': '👍',
    ':thumbsdown:': '👎',
    ':heart:': '❤️',
    ':fire:': '🔥',
    ':100:': '💯',
    ':tada:': '🎉',
    ':joy:': '😂',
    ':sob:': '😭',
    ':rage:': '😡',
    ':thinking:': '🤔',
    ':shrug:': '🤷',
    ':wave:': '👋',
    ':clap:': '👏',
    ':pray:': '🙏',
  };

  let result = text;
  for (const [shortcode, emoji] of Object.entries(shortcodes)) {
    result = result.replace(new RegExp(escapeRegExp(shortcode), 'g'), emoji);
  }
  return result;
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get emoji skin tone variants
 */
export function getEmojiVariants(baseEmoji: string): string[] {
  const skinTones = ['🏻', '🏼', '🏽', '🏾', '🏿'];
  const variants = [baseEmoji];
  
  // Add skin tone variants for applicable emojis
  if (canHaveSkinTone(baseEmoji)) {
    skinTones.forEach(tone => {
      variants.push(baseEmoji + tone);
    });
  }
  
  return variants;
}

/**
 * Check if an emoji can have skin tone modifiers
 */
function canHaveSkinTone(emoji: string): boolean {
  const skinToneEmojis = [
    '👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👩', '🧓', '👴', '👵', '🙍', '🙎', '🙅', '🙆', '💁', '🙋', '🧏', '🙇', '🤦', '🤷', '👮', '🕵', '💂', '🥷', '👷', '🤴', '👸', '👳', '👲', '🧕', '🤵', '👰', '🤰', '🤱', '👼', '🎅', '🤶', '🦸', '🦹', '🧙', '🧚', '🧛', '🧜', '🧝', '🧞', '🧟', '💆', '💇', '🚶', '🧍', '🧎', '🏃', '💃', '🕺', '🕴', '👯', '🧖', '🧗', '🏇', '⛷', '🏂', '🏌', '🏄', '🚣', '🏊', '⛹', '🏋', '🚴', '🚵', '🤸', '🤼', '🤽', '🤾', '🤹', '🧘', '🛀', '🛌'
  ];
  
  return skinToneEmojis.includes(emoji);
}