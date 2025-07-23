import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

export interface ResourceFolder {
  id: string;
  name: string;
  description?: string;
  image?: string;
  creator: string;
  createdAt: number;
  addPermission: 'admins' | 'moderators' | 'members';
  tags: string[];
  resourceCount: number;
  event: NostrEvent;
}

export interface FolderResource {
  id: string;
  folderId: string;
  title: string;
  description?: string;
  type: 'url' | 'note' | 'article';
  url?: string;
  eventId?: string;
  creator: string;
  createdAt: number;
  event: NostrEvent;
}

// Validate resource folder events
function validateResourceFolderEvent(event: NostrEvent, expectedCommunityId: string): boolean {
  if (event.kind !== 30004) return false; // Using kind 30004 for folders

  const d = event.tags.find(([name]) => name === 'd')?.[1];
  if (!d) return false;

  // Check if the event belongs to the expected community
  const communityTag = event.tags.find(([name]) => name === 'a')?.[1];
  if (!communityTag || communityTag !== expectedCommunityId) {
    return false;
  }

  return true;
}

// Parse resource folder event
function parseResourceFolderEvent(event: NostrEvent): ResourceFolder | null {
  try {
    const d = event.tags.find(([name]) => name === 'd')?.[1] || '';
    const title = event.tags.find(([name]) => name === 'title')?.[1] || d;
    const description = event.tags.find(([name]) => name === 'description')?.[1];
    const image = event.tags.find(([name]) => name === 'image')?.[1];
    const addPermission = event.tags.find(([name]) => name === 'add_permission')?.[1] as 'admins' | 'moderators' | 'members' || 'moderators';

    // Extract hashtags
    const tags = event.tags
      .filter(([name]) => name === 't')
      .map(([, tag]) => tag);

    return {
      id: d,
      name: title,
      description,
      image,
      creator: event.pubkey,
      createdAt: event.created_at,
      addPermission,
      tags,
      resourceCount: 0, // Will be populated separately
      event,
    };
  } catch {
    return null;
  }
}

// Validate individual resource events
function validateResourceEvent(event: NostrEvent, expectedCommunityId: string): boolean {
  if (event.kind !== 30005) return false; // Using kind 30005 for individual resources

  const d = event.tags.find(([name]) => name === 'd')?.[1];
  if (!d) return false;

  // Check if the event belongs to the expected community
  const communityTag = event.tags.find(([name]) => name === 'a')?.[1];
  if (!communityTag || communityTag !== expectedCommunityId) {
    return false;
  }

  // Must have a folder reference
  const folderTag = event.tags.find(([name]) => name === 'folder')?.[1];
  if (!folderTag) return false;

  return true;
}

// Parse individual resource event
function parseResourceEvent(event: NostrEvent): FolderResource | null {
  try {
    const d = event.tags.find(([name]) => name === 'd')?.[1] || '';
    const folderId = event.tags.find(([name]) => name === 'folder')?.[1] || '';
    const title = event.tags.find(([name]) => name === 'title')?.[1] || '';
    const description = event.tags.find(([name]) => name === 'description')?.[1];
    const resourceType = event.tags.find(([name]) => name === 'resource_type')?.[1] as 'url' | 'note' | 'article' || 'url';

    // Get the actual resource reference
    let url: string | undefined;
    let eventId: string | undefined;

    if (resourceType === 'url') {
      url = event.tags.find(([name]) => name === 'r')?.[1];
    } else if (resourceType === 'note') {
      eventId = event.tags.find(([name]) => name === 'e')?.[1];
    } else if (resourceType === 'article') {
      eventId = event.tags.find(([name]) => name === 'a')?.[1];
    }

    return {
      id: d,
      folderId,
      title,
      description,
      type: resourceType,
      url,
      eventId,
      creator: event.pubkey,
      createdAt: event.created_at,
      event,
    };
  } catch {
    return null;
  }
}

// Hook to get all resource folders for a community
export function useResourceFolders(communityId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['resource-folders', communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Parse community ID to get the components for filtering
      const [kind, pubkey, identifier] = communityId.split(':');

      if (!kind || !pubkey || !identifier) {
        return [];
      }

      // Query for resource folder events
      const events = await nostr.query([
        {
          kinds: [30004], // Resource folders
          '#a': [`${kind}:${pubkey}:${identifier}`], // Filter by community
          limit: 100,
        }
      ], { signal });

      const validEvents = events.filter(event => validateResourceFolderEvent(event, `${kind}:${pubkey}:${identifier}`));
      const folders = validEvents
        .map(parseResourceFolderEvent)
        .filter((folder): folder is ResourceFolder => folder !== null);

      // Get resource counts for each folder
      const folderIds = folders.map(f => f.id);
      if (folderIds.length > 0) {
        const resourceEvents = await nostr.query([
          {
            kinds: [30005], // Individual resources
            '#a': [`${kind}:${pubkey}:${identifier}`], // Filter by community
            '#folder': folderIds, // Filter by folder IDs
            limit: 1000,
          }
        ], { signal });

        const validResourceEvents = resourceEvents.filter(event => validateResourceEvent(event, `${kind}:${pubkey}:${identifier}`));
        
        // Count resources per folder
        const resourceCounts: Record<string, number> = {};
        validResourceEvents.forEach(event => {
          const folderId = event.tags.find(([name]) => name === 'folder')?.[1];
          if (folderId) {
            resourceCounts[folderId] = (resourceCounts[folderId] || 0) + 1;
          }
        });

        // Update folder resource counts
        folders.forEach(folder => {
          folder.resourceCount = resourceCounts[folder.id] || 0;
        });
      }

      // Sort by creation date (newest first)
      return folders.sort((a, b) => b.createdAt - a.createdAt);
    },
    enabled: !!communityId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Hook to get resources for a specific folder
export function useFolderResources(communityId: string, folderId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['folder-resources', communityId, folderId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Parse community ID to get the components for filtering
      const [kind, pubkey, identifier] = communityId.split(':');

      if (!kind || !pubkey || !identifier) {
        return [];
      }

      // Query for resources in this folder
      const events = await nostr.query([
        {
          kinds: [30005], // Individual resources
          '#a': [`${kind}:${pubkey}:${identifier}`], // Filter by community
          '#folder': [folderId], // Filter by folder ID
          limit: 200,
        }
      ], { signal });

      const validEvents = events.filter(event => validateResourceEvent(event, `${kind}:${pubkey}:${identifier}`));
      const resources = validEvents
        .map(parseResourceEvent)
        .filter((resource): resource is FolderResource => resource !== null);

      // Sort by creation date (newest first)
      return resources.sort((a, b) => b.createdAt - a.createdAt);
    },
    enabled: !!communityId && !!folderId,
    staleTime: 1000 * 60 * 1, // 1 minute
  });
}