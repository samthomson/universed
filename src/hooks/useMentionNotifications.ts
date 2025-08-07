import { useMutation } from '@tanstack/react-query';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';
import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Hook to send mention notifications when users are mentioned in messages
 */
export function useMentionNotifications() {
  const { mutate: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ 
      mentionedPubkeys, 
      messageEvent, 
      communityId, 
      channelId 
    }: {
      mentionedPubkeys: string[];
      messageEvent: NostrEvent;
      communityId: string;
      channelId: string;
    }) => {
      if (!user) {
        throw new Error('User must be logged in to send mention notifications');
      }

      // Skip sending notifications to self
      const filteredPubkeys = mentionedPubkeys.filter(pubkey => pubkey !== user.pubkey);
      
      if (filteredPubkeys.length === 0) {
        return; // No one to notify
      }

      // Create mention notification events for each mentioned user
      const notificationPromises = filteredPubkeys.map(async (pubkey) => {
        const notificationContent = JSON.stringify({
          type: 'mention',
          message: messageEvent.content.slice(0, 100) + (messageEvent.content.length > 100 ? '...' : ''),
          author: user.pubkey,
          communityId,
          channelId,
          timestamp: Date.now()
        });

        return createEvent({
          kind: 9734, // Using a custom kind for mention notifications
          content: notificationContent,
          tags: [
            ['p', pubkey], // Target user
            ['e', messageEvent.id], // Original message
            ['a', communityId], // Community context
            ['t', channelId], // Channel context
            ['k', messageEvent.kind.toString()], // Original message kind
          ]
        });
      });

      // Send all notifications in parallel
      await Promise.allSettled(notificationPromises);
    },
  });
}