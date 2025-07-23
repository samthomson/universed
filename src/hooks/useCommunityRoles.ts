import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';
import { useCommunities } from './useCommunities';
import type { NostrEvent } from '@nostrify/nostrify';

export type CommunityRole = 'owner' | 'admin' | 'moderator' | 'member';

export interface UserRole {
  pubkey: string;
  role: CommunityRole;
  assignedAt: number;
  assignedBy: string;
}

export interface AssignRoleParams {
  communityId: string;
  userPubkey: string;
  role: CommunityRole;
}

export interface RemoveRoleParams {
  communityId: string;
  userPubkey: string;
}

/**
 * Hook to check user's role in a community
 */
export function useUserRole(communityId: string, userPubkey?: string) {
  const { data: communities } = useCommunities();
  const { user } = useCurrentUser();

  const targetPubkey = userPubkey || user?.pubkey;

  if (!communities || !targetPubkey) {
    return { role: 'member' as CommunityRole, hasModeratorAccess: false };
  }

  const community = communities.find(c => c.id === communityId);
  if (!community) {
    return { role: 'member' as CommunityRole, hasModeratorAccess: false };
  }

  // Check if user is the community owner
  if (community.creator === targetPubkey) {
    return { role: 'owner' as CommunityRole, hasModeratorAccess: true };
  }

  // Check if user is a moderator
  if (community.moderators.includes(targetPubkey)) {
    return { role: 'moderator' as CommunityRole, hasModeratorAccess: true };
  }

  return { role: 'member' as CommunityRole, hasModeratorAccess: false };
}

/**
 * Hook to manage community roles
 */
export function useCommunityRoles(communityId: string) {
  const { nostr } = useNostr();
  const { mutate: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  // Get current community definition to update moderators
  const getCommunityDefinition = async (): Promise<NostrEvent | null> => {
    const signal = AbortSignal.timeout(5000);

    const events = await nostr.query([
      {
        kinds: [34550],
        '#d': [communityId.split(':')[2]], // Extract d-tag from community ID
        authors: [communityId.split(':')[1]], // Extract author from community ID
        limit: 1,
      }
    ], { signal });

    return events[0] || null;
  };

  // Assign moderator role
  const assignModerator = useMutation({
    mutationFn: async ({ userPubkey }: { userPubkey: string }) => {
      if (!user) {
        throw new Error('User must be logged in to assign roles');
      }

      const communityEvent = await getCommunityDefinition();
      if (!communityEvent) {
        throw new Error('Community not found');
      }

      // Check if user is owner
      if (communityEvent.pubkey !== user.pubkey) {
        throw new Error('Only community owner can assign moderator roles');
      }

      // Get current moderators
      const currentModerators = new Set<string>();
      communityEvent.tags
        .filter(([name, , , role]) => name === 'p' && role === 'moderator')
        .forEach(([, pubkey]) => {
          if (pubkey) currentModerators.add(pubkey);
        });

      // Add new moderator
      currentModerators.add(userPubkey);

      // Rebuild tags with new moderator list
      const newTags = communityEvent.tags
        .filter(([name, , , role]) => !(name === 'p' && role === 'moderator'))
        .concat(
          Array.from(currentModerators).map(pubkey => ['p', pubkey, '', 'moderator'])
        );

      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: 34550,
            content: communityEvent.content,
            tags: newTags,
          },
          {
            onSuccess: () => resolve(),
            onError: (error) => reject(error),
          }
        );
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['community-roles'] });
    },
  });

  // Remove moderator role
  const removeModerator = useMutation({
    mutationFn: async ({ userPubkey }: { userPubkey: string }) => {
      if (!user) {
        throw new Error('User must be logged in to remove roles');
      }

      const communityEvent = await getCommunityDefinition();
      if (!communityEvent) {
        throw new Error('Community not found');
      }

      // Check if user is owner
      if (communityEvent.pubkey !== user.pubkey) {
        throw new Error('Only community owner can remove moderator roles');
      }

      // Get current moderators and remove the specified one
      const currentModerators = new Set<string>();
      communityEvent.tags
        .filter(([name, , , role]) => name === 'p' && role === 'moderator')
        .forEach(([, pubkey]) => {
          if (pubkey && pubkey !== userPubkey) {
            currentModerators.add(pubkey);
          }
        });

      // Rebuild tags without the removed moderator
      const newTags = communityEvent.tags
        .filter(([name, , , role]) => !(name === 'p' && role === 'moderator'))
        .concat(
          Array.from(currentModerators).map(pubkey => ['p', pubkey, '', 'moderator'])
        );

      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: 34550,
            content: communityEvent.content,
            tags: newTags,
          },
          {
            onSuccess: () => resolve(),
            onError: (error) => reject(error),
          }
        );
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['community-roles'] });
    },
  });

  return {
    assignModerator: assignModerator.mutate,
    removeModerator: removeModerator.mutate,
    isAssigningModerator: assignModerator.isPending,
    isRemovingModerator: removeModerator.isPending,
  };
}

/**
 * Hook to get all moderators for a community
 */
export function useCommunityModerators(communityId: string) {
  const { data: communities } = useCommunities();

  const community = communities?.find(c => c.id === communityId);

  return {
    moderators: community?.moderators || [],
    owner: community?.creator,
    isLoading: !communities,
  };
}

/**
 * Hook to check if current user can perform moderation actions
 */
export function useCanModerate(communityId: string) {
  const { user } = useCurrentUser();
  const { role, hasModeratorAccess } = useUserRole(communityId, user?.pubkey);

  return {
    canModerate: hasModeratorAccess,
    canAssignModerators: role === 'owner',
    canDeletePosts: hasModeratorAccess,
    canBanUsers: hasModeratorAccess,
    canMuteUsers: hasModeratorAccess,
    canPinPosts: hasModeratorAccess,
    canApproveContent: hasModeratorAccess,
    role,
  };
}