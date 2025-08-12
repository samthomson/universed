import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';
import { useCanModerate } from './useCommunityRoles';
import { useCommunityMembers } from './useCommunityMembers';
import { useUserCommunityMembership } from './useUserCommunityMembership';
import type { NostrEvent } from '@nostrify/nostrify';

export interface ChannelPermissions {
  channelId: string;
  communityId: string;
  readPermissions: 'everyone' | 'members' | 'moderators' | 'specific';
  writePermissions: 'everyone' | 'members' | 'moderators' | 'specific';
  allowedReaders: string[]; // pubkeys for specific read permissions
  allowedWriters: string[]; // pubkeys for specific write permissions
  deniedReaders: string[]; // pubkeys explicitly denied read access
  deniedWriters: string[]; // pubkeys explicitly denied write access
  creator: string;
  event: NostrEvent;
}

export interface ChannelPermissionsContent {
  readPermissions: 'everyone' | 'members' | 'moderators' | 'specific';
  writePermissions: 'everyone' | 'members' | 'moderators' | 'specific';
}

function validateChannelPermissionsEvent(event: NostrEvent): boolean {
  if (event.kind !== 30143) return false;

  const d = event.tags.find(([name]) => name === 'd')?.[1];
  const channelRef = event.tags.find(([name]) => name === 'channel')?.[1];

  if (!d || !channelRef) return false;

  try {
    const content = JSON.parse(event.content) as ChannelPermissionsContent;
    const validPermissions = ['everyone', 'members', 'moderators', 'specific'];
    if (!validPermissions.includes(content.readPermissions) ||
        !validPermissions.includes(content.writePermissions)) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

function parseChannelPermissionsEvent(event: NostrEvent): ChannelPermissions {
  const channelId = event.tags.find(([name]) => name === 'channel')?.[1] || '';
  const communityId = event.tags.find(([name]) => name === 'a')?.[1] || '';

  // Extract allowed/denied users from tags
  const allowedReaders = event.tags
    .filter(([name, , , permission]) => name === 'p' && permission === 'read-allow')
    .map(([, pubkey]) => pubkey);

  const allowedWriters = event.tags
    .filter(([name, , , permission]) => name === 'p' && permission === 'write-allow')
    .map(([, pubkey]) => pubkey);

  const deniedReaders = event.tags
    .filter(([name, , , permission]) => name === 'p' && permission === 'read-deny')
    .map(([, pubkey]) => pubkey);

  const deniedWriters = event.tags
    .filter(([name, , , permission]) => name === 'p' && permission === 'write-deny')
    .map(([, pubkey]) => pubkey);

  let content: ChannelPermissionsContent;
  try {
    content = JSON.parse(event.content);
  } catch {
    content = { readPermissions: 'everyone', writePermissions: 'members' };
  }

  return {
    channelId,
    communityId,
    readPermissions: content.readPermissions,
    writePermissions: content.writePermissions,
    allowedReaders,
    allowedWriters,
    deniedReaders,
    deniedWriters,
    creator: event.pubkey,
    event,
  };
}

export function useChannelPermissions(communityId: string | null, channelId: string | null) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['channel-permissions', communityId, channelId],
    queryFn: async (c) => {
      if (!communityId || !channelId) return null;

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(2000)]); // Reduced timeout for faster response

      try {
        const events = await nostr.query([
          {
            kinds: [30143], // Channel permissions events
            '#d': [`${communityId}:${channelId}`],
            limit: 1,
          }
        ], { signal });

        const validEvents = events.filter(validateChannelPermissionsEvent);
        if (validEvents.length === 0) {
          // Return default permissions if none set
          return {
            channelId,
            communityId,
            readPermissions: 'everyone' as const,
            writePermissions: 'members' as const,
            allowedReaders: [],
            allowedWriters: [],
            deniedReaders: [],
            deniedWriters: [],
            creator: '',
            event: {} as NostrEvent,
          };
        }

        return parseChannelPermissionsEvent(validEvents[0]);
      } catch (error) {
        console.error('Failed to fetch channel permissions:', error);
        return null;
      }
    },
    enabled: !!communityId && !!channelId,
    staleTime: 1000 * 30, // 30 seconds - increased to reduce refetches
    refetchInterval: 1000 * 60, // Refetch every minute instead of 30 seconds
  });
}

export function useUpdateChannelPermissions(communityId: string, channelId: string) {
  const { mutateAsync: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const { canModerate } = useCanModerate(communityId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      readPermissions,
      writePermissions,
      allowedReaders = [],
      allowedWriters = [],
      deniedReaders = [],
      deniedWriters = [],
    }: {
      readPermissions: 'everyone' | 'members' | 'moderators' | 'specific';
      writePermissions: 'everyone' | 'members' | 'moderators' | 'specific';
      allowedReaders?: string[];
      allowedWriters?: string[];
      deniedReaders?: string[];
      deniedWriters?: string[];
    }) => {
      if (!user || !canModerate) {
        throw new Error('Only moderators and admins can update channel permissions');
      }

      const tags = [
        ['d', `${communityId}:${channelId}`],
        ['a', communityId],
        ['channel', channelId],
        ['t', 'channel-permissions'],
        ['alt', `Channel permissions for ${channelId}`],
      ];

      // Add user permission tags
      allowedReaders.forEach(pubkey => {
        tags.push(['p', pubkey, '', 'read-allow']);
      });

      allowedWriters.forEach(pubkey => {
        tags.push(['p', pubkey, '', 'write-allow']);
      });

      deniedReaders.forEach(pubkey => {
        tags.push(['p', pubkey, '', 'read-deny']);
      });

      deniedWriters.forEach(pubkey => {
        tags.push(['p', pubkey, '', 'write-deny']);
      });

      await createEvent({
        kind: 30143,
        content: JSON.stringify({
          readPermissions,
          writePermissions,
        }),
        tags,
      });
    },
    onSuccess: () => {
      // Invalidate all related queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ['channel-permissions', communityId, channelId] });
      queryClient.invalidateQueries({ queryKey: ['messages', communityId, channelId] });
      queryClient.invalidateQueries({ queryKey: ['channels', communityId] });
      // Also invalidate the specific channel permission check for all channels
      queryClient.invalidateQueries({ queryKey: ['channel-permissions'] });
    },
  });
}

export function useCanAccessChannel(communityId: string, channelId: string, accessType: 'read' | 'write') {
  const { user } = useCurrentUser();
  const { data: permissions, isLoading: permissionsLoading } = useChannelPermissions(communityId, channelId);
  const { canModerate } = useCanModerate(communityId);
  const { data: members, isLoading: membersLoading } = useCommunityMembers(communityId);
  const { data: membershipStatus, isLoading: membershipLoading } = useUserCommunityMembership(communityId);

  // Use useMemo to return stable object references and prevent unnecessary re-renders
  return useMemo(() => {
    // If user is not logged in, deny access
    if (!user) {
      return { canAccess: false, reason: 'User not logged in' };
    }

    // If permissions are still loading, deny access temporarily (security-first approach)
    if (permissionsLoading || membershipLoading) {
      return { canAccess: false, reason: 'Loading permissions...' };
    }

    // Check if user is already a member (owner, moderator, or approved member)
    const isApprovedMember = membershipStatus === 'owner' || membershipStatus === 'moderator' || membershipStatus === 'approved';

    // If no permissions found, use default permissions
    if (!permissions) {
      if (accessType === 'read') {
        // Default: everyone can read
        return { canAccess: true, reason: 'Default read access for everyone' };
      } else {
        // Default: only members can write
        if (membersLoading) {
          return { canAccess: false, reason: 'Loading member list...' };
        }

        const isMember = canModerate || isApprovedMember || (members && members.some(member => member.pubkey === user.pubkey));
        return {
          canAccess: !!isMember,
          reason: isMember ? 'Default write access for members' : 'Default: only members can write'
        };
      }
    }

    const userPubkey = user.pubkey;
    const permissionType = accessType === 'read' ? permissions.readPermissions : permissions.writePermissions;
    const deniedList = accessType === 'read' ? permissions.deniedReaders : permissions.deniedWriters;
    const allowedList = accessType === 'read' ? permissions.allowedReaders : permissions.allowedWriters;

    // Check if user is explicitly denied
    if (deniedList.includes(userPubkey)) {
      return { canAccess: false, reason: 'User is explicitly denied access' };
    }

    // Moderators and admins always have access unless explicitly denied
    if (canModerate) {
      return { canAccess: true, reason: 'User has moderator access' };
    }

    switch (permissionType) {
      case 'everyone':
        return { canAccess: true, reason: 'Channel allows everyone' };

      case 'members': {
        // If members are still loading, deny access temporarily
        if (membersLoading) {
          return { canAccess: false, reason: 'Loading member list...' };
        }

        // Check if user is a community member (including approved members from membership status)
        const isMember = isApprovedMember || members?.some(member => member.pubkey === userPubkey);
        return {
          canAccess: !!isMember,
          reason: isMember ? 'User is a community member' : 'Only community members can access this channel'
        };
      }

      case 'moderators':
        return {
          canAccess: canModerate,
          reason: canModerate ? 'User has moderator access' : 'Only moderators can access this channel'
        };

      case 'specific': {
        const hasSpecificAccess = allowedList.includes(userPubkey);
        return {
          canAccess: hasSpecificAccess,
          reason: hasSpecificAccess ? 'User has specific access' : 'User not in allowed list'
        };
      }

      default:
        return { canAccess: false, reason: 'Unknown permission type' };
    }
  }, [user, permissions, permissionsLoading, canModerate, members, membersLoading, membershipStatus, membershipLoading, accessType]);
}