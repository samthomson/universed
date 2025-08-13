import { useMemo, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { useCurrentUser } from './useCurrentUser';
import type { UserCommunity } from './useUserCommunities';

interface CommunityOrderStorage {
  [userPubkey: string]: string[]; // Array of community IDs in custom order
}

/**
 * Hook for managing custom community order with localStorage persistence.
 * 
 * Features:
 * - Persists custom order per user in localStorage
 * - Falls back to membership-based sorting for new communities
 * - Maintains membership tier grouping (owner > moderator > approved)
 * - Provides drag-and-drop reorder functionality
 */
export function useCommunityOrder(communities: UserCommunity[] | undefined) {
  const { user } = useCurrentUser();
  const [communityOrderStorage, setCommunityOrderStorage] = useLocalStorage<CommunityOrderStorage>(
    'community-order',
    {}
  );

  // Get the current user's custom order array
  const userCustomOrder = user?.pubkey ? communityOrderStorage[user.pubkey] || [] : [];

  // Apply custom ordering across all communities (no tier restrictions)
  const orderedCommunities = useMemo(() => {
    if (!communities || !user?.pubkey) {
      return communities || [];
    }

    if (userCustomOrder.length === 0) {
      // No custom order stored, use default membership-based order
      return communities.sort((a, b) => {
        const statusOrder = { owner: 0, moderator: 1, approved: 2 };
        return statusOrder[a.membershipStatus] - statusOrder[b.membershipStatus];
      });
    }

    // Create a map for O(1) lookup
    const communityMap = new Map(communities.map(c => [c.id, c]));
    const ordered: UserCommunity[] = [];
    const unordered: UserCommunity[] = [];

    // First, add communities in custom order
    for (const communityId of userCustomOrder) {
      const community = communityMap.get(communityId);
      if (community) {
        ordered.push(community);
        communityMap.delete(communityId);
      }
    }

    // Then add any new communities that aren't in the custom order yet
    // Sort new communities by membership status
    const newCommunities = Array.from(communityMap.values()).sort((a, b) => {
      const statusOrder = { owner: 0, moderator: 1, approved: 2 };
      return statusOrder[a.membershipStatus] - statusOrder[b.membershipStatus];
    });

    return [...ordered, ...newCommunities];
  }, [communities, userCustomOrder, user?.pubkey]);

  // Save new community order
  const updateCommunityOrder = useCallback((newOrder: string[]) => {
    if (!user?.pubkey) return;

    setCommunityOrderStorage(prev => ({
      ...prev,
      [user.pubkey]: newOrder,
    }));
  }, [user?.pubkey, setCommunityOrderStorage]);

  // Handle drag and drop reordering
  const reorderCommunities = useCallback((activeId: string, overId: string) => {
    if (!orderedCommunities || activeId === overId) return;

    const oldIndex = orderedCommunities.findIndex(c => c.id === activeId);
    const newIndex = orderedCommunities.findIndex(c => c.id === overId);

    if (oldIndex === -1 || newIndex === -1) return;

    // Create new order array
    const newOrder = [...orderedCommunities];
    const [movedItem] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, movedItem);

    // Extract just the IDs for storage
    const newOrderIds = newOrder.map(c => c.id);
    updateCommunityOrder(newOrderIds);
  }, [orderedCommunities, updateCommunityOrder]);

  return {
    orderedCommunities,
    reorderCommunities,
    updateCommunityOrder,
    hasCustomOrder: userCustomOrder.length > 0,
  };
}
