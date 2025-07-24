import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';

export interface AddMemberParams {
  communityId: string;
  memberPubkey: string;
}

export interface RemoveMemberParams {
  communityId: string;
  memberPubkey: string;
}

export interface DeclineMemberParams {
  communityId: string;
  memberPubkey: string;
}

export interface BanMemberParams {
  communityId: string;
  memberPubkey: string;
}

/**
 * Hook for managing community members (adding/removing from approved list).
 * Only works for community moderators and owners.
 */
export function useManageMembers() {
  const { nostr } = useNostr();
  const { mutate: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const addMember = useMutation({
    mutationFn: async ({ communityId, memberPubkey }: AddMemberParams) => {
      console.log('addMember mutationFn called with:', { communityId, memberPubkey, user: user?.pubkey });

      if (!user) {
        console.log('No user logged in');
        throw new Error('User must be logged in to manage members');
      }

      const signal = AbortSignal.timeout(5000);

      // Get current approved members list
      const membershipEvents = await nostr.query([
        {
          kinds: [34551], // Approved members list
          '#d': [communityId],
          limit: 10,
        }
      ], { signal });

      // Get the most recent membership list
      const latestEvent = membershipEvents
        .sort((a, b) => b.created_at - a.created_at)[0];

      // Get current approved members
      const currentMembers = new Set<string>();
      if (latestEvent) {
        latestEvent.tags
          .filter(([name]) => name === 'p')
          .forEach(([, pubkey]) => {
            if (pubkey) currentMembers.add(pubkey);
          });
      }

      // Add the new member
      currentMembers.add(memberPubkey);

      // Create new approved members list
      const tags = [
        ['d', communityId],
        ...Array.from(currentMembers).map(pubkey => ['p', pubkey])
      ];

      console.log('Creating event with tags:', tags);

      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: 34551,
            content: '',
            tags,
          },
          {
            onSuccess: () => {
              console.log('createEvent success');
              resolve();
            },
            onError: (error) => {
              console.log('createEvent error:', error);
              reject(error);
            },
          }
        );
      });
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['community-members'] });
      queryClient.invalidateQueries({ queryKey: ['user-membership'] });
      queryClient.invalidateQueries({ queryKey: ['join-requests'] });
    },
  });

  const removeMember = useMutation({
    mutationFn: async ({ communityId, memberPubkey }: RemoveMemberParams) => {
      if (!user) {
        throw new Error('User must be logged in to manage members');
      }

      const signal = AbortSignal.timeout(5000);

      // Get current approved members list
      const membershipEvents = await nostr.query([
        {
          kinds: [34551], // Approved members list
          '#d': [communityId],
          limit: 10,
        }
      ], { signal });

      // Get the most recent membership list
      const latestEvent = membershipEvents
        .sort((a, b) => b.created_at - a.created_at)[0];

      // Get current approved members
      const currentMembers = new Set<string>();
      if (latestEvent) {
        latestEvent.tags
          .filter(([name]) => name === 'p')
          .forEach(([, pubkey]) => {
            if (pubkey) currentMembers.add(pubkey);
          });
      }

      // Remove the member
      currentMembers.delete(memberPubkey);

      // Create new approved members list
      const tags = [
        ['d', communityId],
        ...Array.from(currentMembers).map(pubkey => ['p', pubkey])
      ];

      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: 34551,
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
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['community-members'] });
      queryClient.invalidateQueries({ queryKey: ['user-membership'] });
      queryClient.invalidateQueries({ queryKey: ['join-requests'] });
    },
  });

  const declineMember = useMutation({
    mutationFn: async ({ communityId, memberPubkey }: DeclineMemberParams) => {
      if (!user) {
        throw new Error('User must be logged in to manage members');
      }

      const signal = AbortSignal.timeout(5000);

      // Get current declined members list
      const declinedEvents = await nostr.query([
        {
          kinds: [34552], // Declined members list
          '#d': [communityId],
          limit: 10,
        }
      ], { signal });

      // Get the most recent declined list
      const latestEvent = declinedEvents
        .sort((a, b) => b.created_at - a.created_at)[0];

      // Get current declined members
      const currentDeclined = new Set<string>();
      if (latestEvent) {
        latestEvent.tags
          .filter(([name]) => name === 'p')
          .forEach(([, pubkey]) => {
            if (pubkey) currentDeclined.add(pubkey);
          });
      }

      // Add the declined member
      currentDeclined.add(memberPubkey);

      // Create new declined members list
      const tags = [
        ['d', communityId],
        ...Array.from(currentDeclined).map(pubkey => ['p', pubkey])
      ];

      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: 34552,
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
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['join-requests'] });
      queryClient.invalidateQueries({ queryKey: ['community-members'] });
      queryClient.invalidateQueries({ queryKey: ['user-membership'] });
    },
  });

  const banMember = useMutation({
    mutationFn: async ({ communityId, memberPubkey }: BanMemberParams) => {
      if (!user) {
        throw new Error('User must be logged in to manage members');
      }

      const signal = AbortSignal.timeout(5000);

      // Get current banned members list
      const bannedEvents = await nostr.query([
        {
          kinds: [34553], // Banned members list
          '#d': [communityId],
          limit: 10,
        }
      ], { signal });

      // Get the most recent banned list
      const latestEvent = bannedEvents
        .sort((a, b) => b.created_at - a.created_at)[0];

      // Get current banned members
      const currentBanned = new Set<string>();
      if (latestEvent) {
        latestEvent.tags
          .filter(([name]) => name === 'p')
          .forEach(([, pubkey]) => {
            if (pubkey) currentBanned.add(pubkey);
          });
      }

      // Add the banned member
      currentBanned.add(memberPubkey);

      // Create new banned members list
      const tags = [
        ['d', communityId],
        ...Array.from(currentBanned).map(pubkey => ['p', pubkey])
      ];

      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: 34553,
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
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['join-requests'] });
      queryClient.invalidateQueries({ queryKey: ['community-members'] });
      queryClient.invalidateQueries({ queryKey: ['user-membership'] });
    },
  });

  return {
    addMember: addMember.mutate,
    removeMember: removeMember.mutate,
    declineMember: declineMember.mutate,
    banMember: banMember.mutate,
    isAddingMember: addMember.isPending,
    isRemovingMember: removeMember.isPending,
    isDecliningMember: declineMember.isPending,
    isBanningMember: banMember.isPending,
  };
}