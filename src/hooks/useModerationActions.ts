import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';
import type { NostrEvent } from '@nostrify/nostrify';

export interface BanUserParams {
  communityId: string;
  userPubkey: string;
  reason?: string;
  duration?: number; // Duration in seconds, undefined for permanent
}

export interface MuteUserParams {
  communityId: string;
  userPubkey: string;
  reason?: string;
  duration?: number;
}

export interface DeletePostParams {
  communityId: string;
  postId: string;
  reason?: string;
}

export interface ApprovePostParams {
  communityId: string;
  post: NostrEvent;
}

export interface PinPostParams {
  communityId: string;
  postId: string;
}

/**
 * Hook for community moderation actions.
 * Only works for community moderators and owners.
 */
export function useModerationActions() {
  const { nostr } = useNostr();
  const { mutate: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  // Ban user from community
  const banUser = useMutation({
    mutationFn: async ({ communityId, userPubkey, reason, duration }: BanUserParams) => {
      if (!user) {
        throw new Error('User must be logged in to perform moderation actions');
      }

      const tags = [
        ['d', `ban-${communityId}-${userPubkey}`],
        ['a', `34550:${communityId}`],
        ['p', userPubkey, '', 'banned'],
        ['action', 'ban'],
        ['community', communityId],
      ];

      if (reason) {
        tags.push(['reason', reason]);
      }

      if (duration) {
        const expiresAt = Math.floor(Date.now() / 1000) + duration;
        tags.push(['expires', expiresAt.toString()]);
      }

      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: 30078, // Application-specific data
            content: reason || '',
            tags,
          },
          {
            onSuccess: () => resolve(),
            onError: (error) => reject(error),
          }
        );
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banned-users'] });
      queryClient.invalidateQueries({ queryKey: ['community-members'] });
    },
  });

  // Mute user in community
  const muteUser = useMutation({
    mutationFn: async ({ communityId, userPubkey, reason, duration }: MuteUserParams) => {
      if (!user) {
        throw new Error('User must be logged in to perform moderation actions');
      }

      const tags = [
        ['d', `mute-${communityId}-${userPubkey}`],
        ['a', `34550:${communityId}`],
        ['p', userPubkey, '', 'muted'],
        ['action', 'mute'],
        ['community', communityId],
      ];

      if (reason) {
        tags.push(['reason', reason]);
      }

      if (duration) {
        const expiresAt = Math.floor(Date.now() / 1000) + duration;
        tags.push(['expires', expiresAt.toString()]);
      }

      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: 30078,
            content: reason || '',
            tags,
          },
          {
            onSuccess: () => resolve(),
            onError: (error) => reject(error),
          }
        );
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['muted-users'] });
    },
  });

  // Delete post from community
  const deletePost = useMutation({
    mutationFn: async ({ communityId, postId, reason }: DeletePostParams) => {
      if (!user) {
        throw new Error('User must be logged in to perform moderation actions');
      }

      const tags = [
        ['e', postId],
        ['a', `34550:${communityId}`],
        ['action', 'delete'],
        ['community', communityId],
      ];

      if (reason) {
        tags.push(['reason', reason]);
      }

      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: 5, // Event deletion request
            content: reason || 'Post deleted by moderator',
            tags,
          },
          {
            onSuccess: () => resolve(),
            onError: (error) => reject(error),
          }
        );
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-posts'] });
      queryClient.invalidateQueries({ queryKey: ['moderation-logs'] });
    },
  });

  // Approve post for community (NIP-72)
  const approvePost = useMutation({
    mutationFn: async ({ communityId, post }: ApprovePostParams) => {
      if (!user) {
        throw new Error('User must be logged in to perform moderation actions');
      }

      const tags = [
        ['a', `34550:${communityId}`],
        ['e', post.id],
        ['p', post.pubkey],
        ['k', post.kind.toString()],
      ];

      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: 4550, // Community post approval
            content: JSON.stringify(post),
            tags,
          },
          {
            onSuccess: () => resolve(),
            onError: (error) => reject(error),
          }
        );
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-posts'] });
      queryClient.invalidateQueries({ queryKey: ['post-approvals'] });
    },
  });

  // Pin post in community
  const pinPost = useMutation({
    mutationFn: async ({ communityId, postId }: PinPostParams) => {
      if (!user) {
        throw new Error('User must be logged in to perform moderation actions');
      }

      const signal = AbortSignal.timeout(5000);

      // Get current pinned posts
      const pinnedEvents = await nostr.query([
        {
          kinds: [30078],
          authors: [user.pubkey],
          '#d': [`pinned-${communityId}`],
          limit: 1,
        }
      ], { signal });

      const currentPins = new Set<string>();
      if (pinnedEvents.length > 0) {
        pinnedEvents[0].tags
          .filter(([name]) => name === 'e')
          .forEach(([, eventId]) => {
            if (eventId) currentPins.add(eventId);
          });
      }

      // Add the new pinned post
      currentPins.add(postId);

      const tags = [
        ['d', `pinned-${communityId}`],
        ['a', `34550:${communityId}`],
        ['action', 'pin'],
        ['community', communityId],
        ...Array.from(currentPins).map(id => ['e', id])
      ];

      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: 30078,
            content: '',
            tags,
          },
          {
            onSuccess: () => resolve(),
            onError: (error) => reject(error),
          }
        );
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pinned-posts'] });
    },
  });

  // Unpin post in community
  const unpinPost = useMutation({
    mutationFn: async ({ communityId, postId }: PinPostParams) => {
      if (!user) {
        throw new Error('User must be logged in to perform moderation actions');
      }

      const signal = AbortSignal.timeout(5000);

      // Get current pinned posts
      const pinnedEvents = await nostr.query([
        {
          kinds: [30078],
          authors: [user.pubkey],
          '#d': [`pinned-${communityId}`],
          limit: 1,
        }
      ], { signal });

      const currentPins = new Set<string>();
      if (pinnedEvents.length > 0) {
        pinnedEvents[0].tags
          .filter(([name]) => name === 'e')
          .forEach(([, eventId]) => {
            if (eventId) currentPins.add(eventId);
          });
      }

      // Remove the pinned post
      currentPins.delete(postId);

      const tags = [
        ['d', `pinned-${communityId}`],
        ['a', `34550:${communityId}`],
        ['action', 'pin'],
        ['community', communityId],
        ...Array.from(currentPins).map(id => ['e', id])
      ];

      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: 30078,
            content: '',
            tags,
          },
          {
            onSuccess: () => resolve(),
            onError: (error) => reject(error),
          }
        );
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pinned-posts'] });
    },
  });

  return {
    banUser,
    muteUser,
    deletePost,
    approvePost,
    pinPost,
    unpinPost,
    isBanningUser: banUser.isPending,
    isMutingUser: muteUser.isPending,
    isDeletingPost: deletePost.isPending,
    isApprovingPost: approvePost.isPending,
    isPinningPost: pinPost.isPending,
    isUnpinningPost: unpinPost.isPending,
  };
}