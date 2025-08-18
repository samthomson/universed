import { useState, useCallback, useEffect, useRef } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useFriends } from './useFriends';
import { useMutualFriends } from './useFollowers';
import { validateDMEvent } from '@/lib/dmUtils';
import { logger } from '@/lib/logger';
import type { NostrEvent } from '@nostrify/nostrify';

interface ConversationCandidate {
  id: string; // Same as pubkey for compatibility
  pubkey: string;
  lastMessage?: NostrEvent;
  lastActivity: number; // Renamed from lastMessageTime for compatibility
  hasNIP4Messages: boolean;
  hasNIP17Messages: boolean;
}

// Configuration for messaging and conversation discovery
// TODO: Move to app settings or local storage for user control
const MESSAGING_CONFIG = {
  // Check mutual followers for conversations (efficient, high probability)
  isWatchingMutualFollows: true,
  // Check users you follow for conversations (moderately efficient)  
  isWatchingUsersFollows: true,
  // Check all messages for conversations (expensive, comprehensive - handled by NIP hooks)
  isWatchingAll: true,
  // Whether to include NIP-17 messages (expensive due to metadata blindness)
  isNIP17Enabled: false,
}

/**
 * Hook for discovering DM conversations using configurable strategies.
 * Can check mutual followers, users you follow, or delegate to NIP hooks for comprehensive scanning.
 */
export function useConversationList() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { data: friends = [] } = useFriends();
  const { data: mutuals = [] } = useMutualFriends();
  
  const [conversations, setConversations] = useState<ConversationCandidate[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);

  // Check a batch of people for DM conversations
  const checkBatchForConversations = useCallback(async (
    people: Array<{ pubkey: string }>, 
    batchSize = 20 // Back to 20 - batch size doesn't affect network load, just UI update frequency
  ): Promise<ConversationCandidate[]> => {
    if (!user) return [];

    const foundConversations: ConversationCandidate[] = [];
    const kinds = MESSAGING_CONFIG.isNIP17Enabled ? [4, 1059] : [4];
    
    // Process in batches to avoid overwhelming the relay
    for (let i = 0; i < people.length; i += batchSize) {
      const batch = people.slice(i, i + batchSize);
      
      // Query each person in the batch for recent DMs (limit 1 to check if conversation exists)
      const batchQueries = batch.map(person => nostr.query([
        { kinds, authors: [person.pubkey], '#p': [user.pubkey], limit: 1 },
        { kinds, authors: [user.pubkey], '#p': [person.pubkey], limit: 1 }
      ], { signal: AbortSignal.timeout(2000) })); // 2 second timeout per query - fast since we hit every contact

      const batchResults = await Promise.allSettled(batchQueries);
      
      batchResults.forEach((result, batchIndex) => {
        if (result.status === 'fulfilled') {
          const dmEvents = result.value.filter(validateDMEvent);
          
          if (dmEvents.length > 0) {
            // Found DMs with this person
            const person = batch[batchIndex];
            const mostRecentDM = dmEvents.reduce((latest, dm) => 
              dm.created_at > latest.created_at ? dm : latest, dmEvents[0]);

            foundConversations.push({
              id: person.pubkey,
              pubkey: person.pubkey,
              lastMessage: mostRecentDM,
              lastActivity: mostRecentDM.created_at,
              hasNIP4Messages: dmEvents.some(dm => dm.kind === 4),
              hasNIP17Messages: dmEvents.some(dm => dm.kind === 1059),
            });
          }
        } else if (result.status === 'rejected') {
          // Log failed queries for debugging
          const person = batch[batchIndex];
          logger.error(`[ConversationDiscovery] Failed to query DMs for ${person.pubkey}:`, result.reason);
        }
      });

      // Update progress
      setProcessedCount(prev => prev + batch.length);
      
      // Small delay between batches to be nice to relays
      if (i + batchSize < people.length) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Back to 100ms - delay doesn't help with concurrent queries
      }
    }

    return foundConversations;
  }, [user, nostr]);

  // Note: scanAllDMs is removed - this responsibility moved to NIP-4 and NIP-17 specific hooks
  // when MESSAGING_CONFIG.isWatchingAll is enabled

  // Main discovery function
  const discoverConversations = useCallback(async () => {
    if (!user || isLoadingConversations) return;
    
    setIsLoadingConversations(true);
    setConversations([]);
    setProcessedCount(0);
    
    try {
      let allConversations: ConversationCandidate[] = [];

      // Phase 1: Check mutual follows if enabled
      if (MESSAGING_CONFIG.isWatchingMutualFollows && mutuals.length > 0) {
        logger.log(`[ConversationDiscovery] Checking ${mutuals.length} mutual followers for conversations`);
        const mutualConversations = await checkBatchForConversations(mutuals);
        allConversations = [...allConversations, ...mutualConversations];
        setConversations([...allConversations]);
        logger.log(`[ConversationDiscovery] Found ${mutualConversations.length} conversations with mutual followers`);
      }

      // Phase 2: Check users you follow if enabled
      if (MESSAGING_CONFIG.isWatchingUsersFollows && friends.length > 0) {
        // Filter out mutuals to avoid duplicates
        const remainingFriends = friends.filter(friend => 
          !mutuals.some(mutual => mutual.pubkey === friend.pubkey)
        );
        
        if (remainingFriends.length > 0) {
          logger.log(`[ConversationDiscovery] Checking ${remainingFriends.length} other friends for conversations`);
          const friendConversations = await checkBatchForConversations(remainingFriends);
          
          allConversations = [...allConversations, ...friendConversations]
            .sort((a, b) => b.lastActivity - a.lastActivity);
          
          setConversations([...allConversations]);
          logger.log(`[ConversationDiscovery] Found ${friendConversations.length} additional conversations with friends`);
        }
      }

      // Phase 3: Note about isWatchingAll
      if (MESSAGING_CONFIG.isWatchingAll) {
        logger.log(`[ConversationDiscovery] isWatchingAll enabled - comprehensive conversation discovery will be handled by NIP-4 and NIP-17 hooks`);
        // This will be handled by the respective NIP hooks when they scan all messages
      }

      logger.log(`[ConversationDiscovery] Total found via friend discovery: ${allConversations.length} conversations`);

    } catch (error) {
      logger.error('[ConversationDiscovery] Failed:', error);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [user, friends, mutuals, checkBatchForConversations, isLoadingConversations]);

  // Auto-start discovery when user is available
  const hasRunDiscovery = useRef(false);
  useEffect(() => {
    if (user && !isLoadingConversations && conversations.length === 0 && !hasRunDiscovery.current) {
      hasRunDiscovery.current = true;
      discoverConversations();
    }
  }, [user, isLoadingConversations, conversations.length, discoverConversations]);

  return {
    conversations,
    isLoading: isLoadingConversations,
    processedCount,
    totalToProcess: Math.max(mutuals.length, friends.length),
    rediscover: discoverConversations,
  };
}