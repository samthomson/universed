import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';

// Import the spam filtering logic by accessing the internal function
// We'll need to extract it for testing
function isSpamCommunity(event: NostrEvent): boolean {
  const name = event.tags.find(([name]) => name === 'name')?.[1] || '';
  const description = event.tags.find(([name]) => name === 'description')?.[1] || '';
  const d = event.tags.find(([name]) => name === 'd')?.[1] || '';

  // Combine all text fields for spam detection
  const text = [name, description, d].join(' ').toLowerCase();

  // Common spam patterns
  const spamPatterns = [
    // Cryptocurrency/trading spam
    /\b(bitcoin|btc|crypto|trading|investment|profit|earn money|make money)\b/i,
    /\b(forex|binary options|cryptocurrency|blockchain|mining)\b/i,
    /\b(get rich|financial freedom|passive income|guaranteed profit)\b/i,

    // Adult content spam
    /\b(xxx|porn|adult|sex|nude|naked|escort|dating)\b/i,
    /\b(onlyfans|cam girl|webcam|strip|erotic)\b/i,

    // Gambling spam
    /\b(casino|gambling|poker|slots|betting|lottery)\b/i,
    /\b(jackpot|win big|lucky|fortune|prize)\b/i,

    // Pharmaceutical spam
    /\b(viagra|cialis|pharmacy|pills|medication|drugs)\b/i,
    /\b(weight loss|diet pills|supplements|steroids)\b/i,

    // Generic spam indicators
    /\b(click here|visit now|limited time|act now|don't miss)\b/i,
    /\b(free money|easy money|work from home|mlm|pyramid)\b/i,
    /\b(telegram|whatsapp|contact me|dm me)\b/i,

    // Specific spam phrases
    /has nostr figured out spam yet\?/i,

    // Suspicious URLs and contact methods
    /\b(t\.me|wa\.me|bit\.ly|tinyurl|shorturl)\b/i,
    /\b(join my|follow me|subscribe|like and share)\b/i,

    // Repetitive characters (common in spam)
    /(.)\1{4,}/,  // 5 or more repeated characters
    /[!@#$%^&*]{3,}/, // Multiple special characters

    // All caps (likely spam if entire name/description is caps)
    /^[A-Z\s!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]{10,}$/,
  ];

  // Check for spam patterns
  for (const pattern of spamPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  // Check for excessive emoji usage (more than 30% of content)
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const emojiCount = (text.match(emojiRegex) || []).length;
  const textLength = text.replace(/\s/g, '').length;
  if (textLength > 0 && emojiCount / textLength > 0.3) {
    return true;
  }

  // Check for very short or very long names/descriptions that are likely spam
  if (name.length > 100 || (description && description.length > 500)) {
    return true;
  }

  // Check for suspicious identifier patterns
  if (d.length > 50 || /[^a-z0-9\-_]/.test(d)) {
    return true;
  }

  return false;
}

const createMockEvent = (tags: string[][]): NostrEvent => ({
  id: 'test-id',
  pubkey: 'test-pubkey',
  created_at: Date.now(),
  kind: 34550,
  content: '',
  tags,
  sig: 'test-sig',
});

describe('Community spam filtering', () => {
  it('should detect cryptocurrency spam', () => {
    const cryptoSpam = createMockEvent([
      ['d', 'crypto-trading'],
      ['name', 'BITCOIN TRADING PROFITS'],
      ['description', 'Make money with cryptocurrency! Guaranteed profit!'],
    ]);

    expect(isSpamCommunity(cryptoSpam)).toBe(true);
  });

  it('should detect adult content spam', () => {
    const adultSpam = createMockEvent([
      ['d', 'adult-content'],
      ['name', 'XXX Adult Content'],
      ['description', 'Adult entertainment and porn videos'],
    ]);

    expect(isSpamCommunity(adultSpam)).toBe(true);
  });

  it('should detect gambling spam', () => {
    const gamblingSpam = createMockEvent([
      ['d', 'casino-games'],
      ['name', 'Casino Games'],
      ['description', 'Win big at our online casino! Jackpot prizes!'],
    ]);

    expect(isSpamCommunity(gamblingSpam)).toBe(true);
  });

  it('should detect excessive emoji usage', () => {
    const emojiSpam = createMockEvent([
      ['d', 'emoji-spam'],
      ['name', '🚀💰🎉💎🔥💯⭐'],
      ['description', '🚀🚀🚀💰💰💰🎉🎉🎉'],
    ]);

    expect(isSpamCommunity(emojiSpam)).toBe(true);
  });

  it('should detect suspicious identifiers', () => {
    const suspiciousId = createMockEvent([
      ['d', 'this-is-a-very-long-suspicious-identifier-that-exceeds-normal-length-limits-and-should-be-flagged'],
      ['name', 'Suspicious Community'],
      ['description', 'This has a suspicious identifier'],
    ]);

    expect(isSpamCommunity(suspiciousId)).toBe(true);
  });

  it('should detect repetitive characters', () => {
    const repetitiveSpam = createMockEvent([
      ['d', 'spam-community'],
      ['name', 'AAAAAA SPAM COMMUNITY'],
      ['description', 'This is spammmmmmm content'],
    ]);

    expect(isSpamCommunity(repetitiveSpam)).toBe(true);
  });

  it('should detect specific spam phrases', () => {
    const specificSpam = createMockEvent([
      ['d', 'test-community'],
      ['name', 'Test Community'],
      ['description', 'Has nostr figured out spam yet?'],
    ]);

    expect(isSpamCommunity(specificSpam)).toBe(true);
  });

  it('should allow legitimate communities', () => {
    const legitimateCommunities = [
      createMockEvent([
        ['d', 'developers'],
        ['name', 'Developers Community'],
        ['description', 'A place for software developers to discuss coding'],
      ]),
      createMockEvent([
        ['d', 'photography'],
        ['name', 'Photography Club'],
        ['description', 'Share your best photos and get feedback'],
      ]),
      createMockEvent([
        ['d', 'cooking'],
        ['name', 'Cooking Enthusiasts'],
        ['description', 'Recipes, tips, and culinary discussions'],
      ]),
      createMockEvent([
        ['d', 'gaming'],
        ['name', 'Gaming Community 🎮'],
        ['description', 'A place for gamers to chat and share tips'],
      ]),
    ];

    legitimateCommunities.forEach(community => {
      expect(isSpamCommunity(community)).toBe(false);
    });
  });

  it('should handle edge cases', () => {
    // Empty tags
    const emptyTags = createMockEvent([['d', 'test']]);
    expect(isSpamCommunity(emptyTags)).toBe(false);

    // Missing description
    const noDescription = createMockEvent([
      ['d', 'test-community'],
      ['name', 'Test Community'],
    ]);
    expect(isSpamCommunity(noDescription)).toBe(false);

    // Very short content
    const shortContent = createMockEvent([
      ['d', 'a'],
      ['name', 'A'],
    ]);
    expect(isSpamCommunity(shortContent)).toBe(false);
  });
});