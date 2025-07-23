import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';
import { useCanModerate } from './useCommunityRoles';
import type { NostrEvent } from '@nostrify/nostrify';

export interface ChannelFolder {
  id: string;
  name: string;
  description?: string;
  position: number;
  communityId: string;
  creator: string;
  event: NostrEvent;
}

export interface ChannelFolderContent {
  name: string;
  description?: string;
  position: number;
}

function validateChannelFolderEvent(event: NostrEvent): boolean {
  if (event.kind !== 32603) return false;

  const d = event.tags.find(([name]) => name === 'd')?.[1];
  const communityRef = event.tags.find(([name]) => name === 'a')?.[1];

  if (!d || !communityRef) return false;

  try {
    const content = JSON.parse(event.content) as ChannelFolderContent;
    if (!content.name || typeof content.position !== 'number') {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

function parseChannelFolderEvent(event: NostrEvent, communityId: string): ChannelFolder {
  const d = event.tags.find(([name]) => name === 'd')?.[1] || '';
  const name = event.tags.find(([name]) => name === 'name')?.[1] || '';
  const description = event.tags.find(([name]) => name === 'description')?.[1];

  let content: ChannelFolderContent;
  try {
    content = JSON.parse(event.content);
  } catch {
    content = { name, position: 0 };
  }

  return {
    id: d.split(':')[1] || name,
    name: content.name || name,
    description: content.description || description,
    position: content.position || 0,
    communityId,
    creator: event.pubkey,
    event,
  };
}

export function useChannelFolders(communityId: string | null) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['channel-folders', communityId],
    queryFn: async (c) => {
      if (!communityId) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      try {
        const events = await nostr.query([
          {
            kinds: [32603], // Channel folder definition events
            '#a': [communityId], // Filter by community
            '#t': ['channel-folder'], // Filter by folder tag
            limit: 100,
          }
        ], { signal });

        const validEvents = events.filter(validateChannelFolderEvent);
        const folders = validEvents.map(event => parseChannelFolderEvent(event, communityId));

        // Sort by position
        return folders.sort((a, b) => a.position - b.position);
      } catch (error) {
        console.error('Failed to fetch channel folders:', error);
        return [];
      }
    },
    enabled: !!communityId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCreateChannelFolder(communityId: string) {
  const { mutateAsync: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const { canModerate } = useCanModerate(communityId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, description, position }: { name: string; description?: string; position: number }) => {
      if (!user || !canModerate) {
        throw new Error('Only moderators and admins can create channel folders');
      }

      const folderId = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-');

      await createEvent({
        kind: 32603,
        content: JSON.stringify({
          name,
          description,
          position,
        }),
        tags: [
          ['d', `${communityId}:${folderId}`],
          ['a', communityId],
          ['name', name],
          ['description', description || ''],
          ['position', position.toString()],
          ['t', 'channel-folder'],
          ['alt', `Channel folder: ${name}`],
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-folders', communityId] });
    },
  });
}

export function useUpdateChannelFolder(communityId: string) {
  const { mutateAsync: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const { canModerate } = useCanModerate(communityId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      folderId, 
      name, 
      description, 
      position 
    }: { 
      folderId: string; 
      name: string; 
      description?: string; 
      position: number; 
    }) => {
      if (!user || !canModerate) {
        throw new Error('Only moderators and admins can update channel folders');
      }

      await createEvent({
        kind: 32603,
        content: JSON.stringify({
          name,
          description,
          position,
        }),
        tags: [
          ['d', `${communityId}:${folderId}`],
          ['a', communityId],
          ['name', name],
          ['description', description || ''],
          ['position', position.toString()],
          ['t', 'channel-folder'],
          ['alt', `Channel folder: ${name}`],
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-folders', communityId] });
    },
  });
}

export function useDeleteChannelFolder(communityId: string) {
  const { mutateAsync: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const { canModerate } = useCanModerate(communityId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ folderEventId }: { folderEventId: string }) => {
      if (!user || !canModerate) {
        throw new Error('Only moderators and admins can delete channel folders');
      }

      await createEvent({
        kind: 5, // Deletion event
        content: 'Channel folder deleted',
        tags: [
          ['e', folderEventId],
          ['k', '32603'],
          ['alt', 'Delete channel folder'],
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-folders', communityId] });
    },
  });
}