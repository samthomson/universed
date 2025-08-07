import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import type { NostrEvent } from '@nostrify/nostrify';

export interface DMSearchResult {
  conversationId: string;
  pubkey: string;
  message: NostrEvent;
  decryptedContent: string;
  matchType: 'content' | 'author' | 'pubkey';
}

export function useDMSearch(searchQuery: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['dm-search', user?.pubkey, searchQuery],
    queryFn: async (c) => {
      if (!user || !searchQuery.trim()) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);
      const query = searchQuery.toLowerCase().trim();
      
      // Query for DMs sent to us and by us
      const [receivedDMs, sentDMs] = await Promise.all([
        // DMs sent to us
        nostr.query([
          {
            kinds: [4, 1059], // NIP-04 and NIP-44 encrypted DMs
            '#p': [user.pubkey],
            limit: 500, // Increased limit for search
          }
        ], { signal }),
        // DMs sent by us
        nostr.query([
          {
            kinds: [4, 1059],
            authors: [user.pubkey],
            limit: 500,
          }
        ], { signal }),
      ]);

      const allDMs = [...receivedDMs, ...sentDMs];
      const results: DMSearchResult[] = [];

      // Process each message
      for (const message of allDMs) {
        // Determine the other person's pubkey
        let otherPubkey: string;
        if (message.pubkey === user.pubkey) {
          // We sent this DM, find the recipient
          const pTag = message.tags.find(([name]) => name === 'p');
          otherPubkey = pTag?.[1] || '';
        } else {
          // We received this DM
          otherPubkey = message.pubkey;
        }

        if (!otherPubkey) continue;

        // Check if pubkey matches search query
        if (otherPubkey.toLowerCase().includes(query)) {
          results.push({
            conversationId: otherPubkey,
            pubkey: otherPubkey,
            message,
            decryptedContent: '', // Will be filled later
            matchType: 'pubkey'
          });
          continue;
        }

        // Try to decrypt and search content
        try {
          let decryptedContent = '';
          
          // Try NIP-44 decryption first
          if (user.signer?.nip44 && message.kind === 1059) {
            decryptedContent = await user.signer.nip44.decrypt(otherPubkey, message.content);
          }
          // Fall back to NIP-04 decryption
          else if (user.signer?.nip04 && message.kind === 4) {
            decryptedContent = await user.signer.nip04.decrypt(otherPubkey, message.content);
          }

          // Check if decrypted content matches search query
          if (decryptedContent.toLowerCase().includes(query)) {
            results.push({
              conversationId: otherPubkey,
              pubkey: otherPubkey,
              message,
              decryptedContent,
              matchType: 'content'
            });
          }
        } catch (error) {
          // Skip messages that can't be decrypted
          console.debug('Could not decrypt message for search:', error);
        }
      }

      // Remove duplicates and sort by most recent
      const uniqueResults = results.filter((result, index, self) => 
        index === self.findIndex(r => r.conversationId === result.conversationId)
      );

      return uniqueResults.sort((a, b) => b.message.created_at - a.message.created_at);
    },
    enabled: !!user && !!searchQuery.trim(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
