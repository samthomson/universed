import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';
import type { NostrEvent } from '@nostrify/nostrify';

const DELETION_KIND = 5;

export function useDeleteMessage() {
  const { mutate: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (messageEvent: NostrEvent) => {
      if (!user || messageEvent.pubkey !== user.pubkey) {
        throw new Error('You can only delete your own messages');
      }

      createEvent({
        kind: DELETION_KIND,
        content: 'Message deleted',
        tags: [
          ['e', messageEvent.id],
          ['k', messageEvent.kind.toString()],
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useEditMessage() {
  const { mutate: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ originalEvent, newContent }: { originalEvent: NostrEvent; newContent: string }) => {
      if (!user || originalEvent.pubkey !== user.pubkey) {
        throw new Error('You can only edit your own messages');
      }

      if (originalEvent.kind === 9411) {
        const originalTags = originalEvent.tags.filter(([name]) => 
          ['t', 'a', 'e', 'p'].includes(name)
        );

        createEvent({
          kind: 9411,
          content: newContent,
          tags: [
            ...originalTags,
            ['e', originalEvent.id, '', 'edit'],
          ],
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}