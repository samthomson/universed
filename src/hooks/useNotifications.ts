import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useLocalStorage } from './useLocalStorage';

export interface Notification {
  id: string;
  type: 'mention' | 'reply' | 'reaction' | 'dm' | 'friend_request';
  title: string;
  message: string;
  eventId?: string;
  fromPubkey?: string;
  timestamp: number;
  read: boolean;
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

      // Get mentions (events that tag the current user)
      const mentionEvents = await nostr.query([{
        kinds: [1, 1111], // Text notes and channel messages
        '#p': [user.pubkey],
        limit: 50,
        since: Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60), // Last 7 days
      }], { signal });

      // Get reactions to user's events
      const userEvents = await nostr.query([{
        kinds: [1, 1111],
        authors: [user.pubkey],
        limit: 20,
        since: Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60), // Last 7 days
      }], { signal });

      const userEventIds = userEvents.map(e => e.id);

      const reactionEvents = userEventIds.length > 0 ? await nostr.query([{
        kinds: [7], // Reactions
        '#e': userEventIds,
        limit: 50,
      }], { signal }) : [];

      // Convert to notifications
      const notifications: Notification[] = [];

      // Process mentions
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
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchInterval: 60000, // Refetch every minute
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