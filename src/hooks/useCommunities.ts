import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { logger } from '@/lib/logger';
import { useUserSettings } from './useUserSettings';

export interface Community {
  id: string;
  name: string;
  description?: string;
  image?: string;
  banner?: string;
  creator: string;
  moderators: string[];
  relays: string[];
  event: NostrEvent;
}

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

function validateCommunityEvent(event: NostrEvent, enableSpamFiltering: boolean): boolean {
  if (event.kind !== 34550) return false;

  const d = event.tags.find(([name]) => name === 'd')?.[1];
  if (!d) return false;

  // Check for spam if filtering is enabled
  if (enableSpamFiltering && isSpamCommunity(event)) {
    // Don't log here - we'll log in useUserCommunities only for communities the user is a member of
    return false;
  }

  return true;
}

function parseCommunityEvent(event: NostrEvent): Community {
  const d = event.tags.find(([name]) => name === 'd')?.[1] || '';
  const name = event.tags.find(([name]) => name === 'name')?.[1] || d;
  const description = event.tags.find(([name]) => name === 'description')?.[1];
  const image = event.tags.find(([name]) => name === 'image')?.[1];
  const banner = event.tags.find(([name]) => name === 'banner')?.[1];

  const moderators = event.tags
    .filter(([name, , , role]) => name === 'p' && role === 'moderator')
    .map(([, pubkey]) => pubkey);

  const relays = event.tags
    .filter(([name]) => name === 'relay')
    .map(([, url]) => url);

  return {
    id: `${event.kind}:${event.pubkey}:${d}`,
    name,
    description,
    image,
    banner,
    creator: event.pubkey,
    moderators,
    relays,
    event,
  };
}

export function useCommunities() {
  const { nostr } = useNostr();
  const { settings } = useUserSettings();

  return useQuery({
    queryKey: ['communities', settings.enableSpamFiltering], // Include spam setting in cache key
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]); // Increased timeout for hybrid approach

      // 🚀 HYBRID APPROACH: Get communities from multiple sources
      const [generalCommunities, membershipBasedCommunities] = await Promise.all([
        // Method 1: Get general communities (like before, but more)
        nostr.query([
          { kinds: [34550], limit: 2000 }
        ], { signal }),

        // Method 2: Chorus-style - find communities through membership events
        (async () => {
          try {
            // Get all membership lists to find community IDs
            const membershipEvents = await nostr.query([
              { kinds: [34551, 34552, 34553], limit: 500 } // Get more membership events
            ], { signal });

            // Extract unique community IDs from membership events
            const communityIds = new Set<string>();
            membershipEvents.forEach(event => {
              const communityId = event.tags.find(([name]) => name === 'd')?.[1];
              if (communityId) {
                communityIds.add(communityId);
              }
            });

            if (communityIds.size === 0) return [];

            // Fetch communities for these IDs in batches
            const communityIdArray = Array.from(communityIds);
            
            if (communityIdArray.length === 0) return [];
            
            // Batch the requests to avoid overwhelming relays
            const BATCH_SIZE = 100;
            const batches: string[][] = [];
            for (let i = 0; i < communityIdArray.length; i += BATCH_SIZE) {
              batches.push(communityIdArray.slice(i, i + BATCH_SIZE));
            }
            
            logger.log(`COMMUNITY_DISCOVERY: Fetching ${communityIdArray.length} membership-based communities in ${batches.length} batches`);
            
            // Execute all batches in parallel
            const batchResults = await Promise.all(
              batches.map(async (batch, index) => {
                try {
                  const events = await nostr.query([
                    { kinds: [34550], '#d': batch }
                  ], { signal });
                  logger.log(`COMMUNITY_DISCOVERY: Batch ${index + 1}/${batches.length} returned ${events.length} communities`);
                  return events;
                } catch (error) {
                  logger.warn(`COMMUNITY_DISCOVERY: Batch ${index + 1} failed:`, error);
                  return [];
                }
              })
            );
            
            // Flatten all batch results
            const allCommunityEvents = batchResults.flat();
            logger.log(`COMMUNITY_DISCOVERY: Total membership-based communities fetched: ${allCommunityEvents.length}`);
            
            return allCommunityEvents;
          } catch (error) {
            logger.warn('COMMUNITY_DISCOVERY: Membership-based community discovery failed:', error);
            return [];
          }
        })()
      ]);

      // Combine and deduplicate communities
      const allEvents = new Map<string, NostrEvent>();
      
      // Add general communities
      generalCommunities.forEach(event => {
        const id = `${event.kind}:${event.pubkey}:${event.tags.find(([name]) => name === 'd')?.[1]}`;
        allEvents.set(id, event);
      });

      // Add membership-based communities (these take priority if there are duplicates)
      membershipBasedCommunities.forEach(event => {
        const id = `${event.kind}:${event.pubkey}:${event.tags.find(([name]) => name === 'd')?.[1]}`;
        allEvents.set(id, event);
      });

      const allEventsArray = Array.from(allEvents.values());
      const validEvents = allEventsArray.filter(event => validateCommunityEvent(event, settings.enableSpamFiltering));
      const spamFiltered = allEventsArray.length - validEvents.length;
      
      logger.log(`COMMUNITY_DISCOVERY: Found ${generalCommunities.length} general + ${membershipBasedCommunities.length} membership-based = ${allEvents.size} total unique communities`);
      logger.log(`COMMUNITY_DISCOVERY: Spam filtered: ${spamFiltered} communities removed, ${validEvents.length} communities remaining`);
      
      return validEvents.map(parseCommunityEvent);
    },
    staleTime: 1000 * 60 * 15, // 15 mns. this query is expensive
    retry: 2,
  });
}

// Export utility functions for reuse
export { isSpamCommunity, parseCommunityEvent };