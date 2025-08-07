import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useLocalStorage } from './useLocalStorage';
import { logger } from '@/lib/logger';

export interface Notification {
  id: string;
  type: 'mention' | 'reply' | 'reaction' | 'dm' | 'friend_request';
  title: string;
  message: string;
  eventId?: string;
  fromPubkey?: string;
  timestamp: number;
  read: boolean;
  communityId?: string;
  channelId?: string;
}

/**
 * Hook to get notifications for the current user
 * This is a simplified implementation that tracks mentions and replies
 */
export function useNotifications() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const [readNotifications] = useLocalStorage<string[]>('read-notifications', []);

  return useQuery({
    queryKey: ['notifications', user?.pubkey],
    queryFn: async (c) => {
      if (!user?.pubkey) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);

      // Optimized parallel queries for mentions and user events
      const since = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60); // Last 7 days

      const [mentionEvents, userEvents, mentionNotifications] = await Promise.all([
        // Get mentions (events that tag the current user)
        nostr.query([{
          kinds: [1, 1111], // Text notes and channel messages
          '#p': [user.pubkey],
          limit: 50,
          since,
        }], { signal }),

        // Get user's events for reaction tracking
        nostr.query([{
          kinds: [1, 1111],
          authors: [user.pubkey],
          limit: 20,
          since,
        }], { signal }),

        // Get explicit mention notifications (kind 9734)
        nostr.query([{
          kinds: [9734], // Mention notifications
          '#p': [user.pubkey],
          limit: 50,
          since,
        }], { signal })
      ]);

      const userEventIds = userEvents.map(e => e.id);

      // Get reactions to user's events if any exist
      const reactionEvents = userEventIds.length > 0 ? await nostr.query([{
        kinds: [7], // Reactions
        '#e': userEventIds,
        limit: 50,
      }], { signal }) : [];

      // Convert to notifications
      const notifications: Notification[] = [];

      // Process explicit mention notifications (kind 9734)
      mentionNotifications.forEach(event => {
        // Skip if it's from the user themselves
        if (event.pubkey === user.pubkey) return;

        try {
          const notificationData = JSON.parse(event.content);

          // Extract community and channel context from tags
          const communityTag = event.tags.find(([name]) => name === 'a')?.[1];
          const channelTag = event.tags.find(([name]) => name === 't')?.[1];
          const originalEventId = event.tags.find(([name]) => name === 'e')?.[1];

          notifications.push({
            id: `${event.id}-mention-notification`,
            type: 'mention',
            title: 'You were mentioned',
            message: notificationData.message || 'Someone mentioned you in a message',
            eventId: originalEventId,
            fromPubkey: event.pubkey,
            timestamp: event.created_at * 1000,
            read: readNotifications.includes(`${event.id}-mention-notification`),
            communityId: communityTag,
            channelId: channelTag,
          });
        } catch (error) {
          logger.warn('Failed to parse mention notification:', error);
        }
      });

      // Process legacy mentions (from p tags in regular messages)
      mentionEvents.forEach(event => {
        // Skip if it's from the user themselves
        if (event.pubkey === user.pubkey) return;

        const isMention = event.tags.some(([name, value]) => name === 'p' && value === user.pubkey);
        const isReply = event.tags.some(([name, value]) => name === 'e' && userEventIds.includes(value));

        if (isMention || isReply) {
          notifications.push({
            id: `${event.id}-mention`,
            type: isReply ? 'reply' : 'mention',
            title: isReply ? 'New Reply' : 'You were mentioned',
            message: event.content.slice(0, 100) + (event.content.length > 100 ? '...' : ''),
            eventId: event.id,
            fromPubkey: event.pubkey,
            timestamp: event.created_at * 1000,
            read: readNotifications.includes(`${event.id}-mention`),
          });
        }
      });

      // Process reactions
      reactionEvents.forEach(event => {
        // Skip if it's from the user themselves
        if (event.pubkey === user.pubkey) return;

        const reactionContent = event.content || '👍';
        notifications.push({
          id: `${event.id}-reaction`,
          type: 'reaction',
          title: 'New Reaction',
          message: `Reacted with ${reactionContent}`,
          eventId: event.id,
          fromPubkey: event.pubkey,
          timestamp: event.created_at * 1000,
          read: readNotifications.includes(`${event.id}-reaction`),
        });
      });

      // Sort by timestamp (newest first)
      return notifications.sort((a, b) => b.timestamp - a.timestamp);
    },
    enabled: !!user?.pubkey,
    staleTime: 60 * 1000, // 1 minute - Notifications don't need to be ultra real-time
    refetchInterval: 2 * 60 * 1000, // 2 minutes - Reduced frequency for better performance
  });
}

/**
 * Hook to mark notifications as read
 */
export function useMarkNotificationsRead() {
  const [readNotifications, setReadNotifications] = useLocalStorage<string[]>('read-notifications', []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationIds: string[]) => {
      const newReadNotifications = [...new Set([...readNotifications, ...notificationIds])];
      setReadNotifications(newReadNotifications);
      return newReadNotifications;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/**
 * Hook to get unread notification count
 */
export function useUnreadNotificationCount() {
  const { data: notifications = [] } = useNotifications();
  return notifications.filter(n => !n.read).length;
}

/**
 * Hook to request browser notification permissions and show notifications
 */
export function useBrowserNotifications() {
  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  };

  const showNotification = (title: string, options?: NotificationOptions) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      return new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      });
    }
    return null;
  };

  return {
    requestPermission,
    showNotification,
    isSupported: 'Notification' in window,
    permission: 'Notification' in window ? Notification.permission : 'denied',
  };
}