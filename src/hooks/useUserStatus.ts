import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';

export interface UserStatus {
  status: 'online' | 'away' | 'busy' | 'offline';
  customMessage?: string;
  lastSeen?: number;
}

const USER_STATUS_KIND = 30315;

export function useUserStatus(pubkey?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const targetPubkey = pubkey || user?.pubkey;

  return useQuery({
    queryKey: ['user-status', targetPubkey],
    queryFn: async (c) => {
      if (!targetPubkey) return null;

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      const events = await nostr.query([{
        kinds: [USER_STATUS_KIND],
        authors: [targetPubkey],
        limit: 1,
      }], { signal });

      if (events.length === 0) {
        return {
          status: 'offline' as const,
          lastSeen: Date.now(),
        };
      }

      const event = events[0];
      const statusTag = event.tags.find(([name]) => name === 'status')?.[1];
      const messageTag = event.tags.find(([name]) => name === 'message')?.[1];

      return {
        status: (statusTag as UserStatus['status']) || 'offline',
        customMessage: messageTag,
        lastSeen: event.created_at * 1000,
      };
    },
    enabled: !!targetPubkey,
    refetchInterval: 60000,
  });
}

export function useUpdateUserStatus() {
  const { mutate: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (status: UserStatus) => {
      const tags = [
        ['d', 'status'],
        ['status', status.status],
      ];

      if (status.customMessage) {
        tags.push(['message', status.customMessage]);
      }

      createEvent({
        kind: USER_STATUS_KIND,
        content: '',
        tags,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-status'] });
    },
  });
}