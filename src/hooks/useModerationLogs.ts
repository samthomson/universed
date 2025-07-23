import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

export interface ModerationAction {
  id: string;
  moderatorPubkey: string;
  action: 'ban' | 'mute' | 'delete' | 'approve' | 'pin' | 'unpin' | 'warn';
  targetPubkey?: string;
  targetEventId?: string;
  communityId: string;
  reason: string;
  duration?: number;
  expiresAt?: number;
  createdAt: number;
  event: NostrEvent;
}

function validateModerationEvent(event: NostrEvent): boolean {
  // Check for moderation-related events
  if (![5, 4550, 30078].includes(event.kind)) return false;
  
  // Must have action or be a known moderation kind
  const actionTag = event.tags.find(([name]) => name === 'action');
  if (!actionTag && event.kind !== 5 && event.kind !== 4550) return false;
  
  return true;
}

function parseModerationEvent(event: NostrEvent): ModerationAction {
  const actionTag = event.tags.find(([name]) => name === 'action');
  const communityTag = event.tags.find(([name]) => name === 'community');
  const aTag = event.tags.find(([name]) => name === 'a');
  const pTag = event.tags.find(([name]) => name === 'p');
  const eTag = event.tags.find(([name]) => name === 'e');
  const reasonTag = event.tags.find(([name]) => name === 'reason');
  const expiresTag = event.tags.find(([name]) => name === 'expires');
  
  // Determine action type based on event kind and tags
  let action: ModerationAction['action'] = 'approve';
  if (event.kind === 5) {
    action = 'delete';
  } else if (event.kind === 4550) {
    action = 'approve';
  } else if (actionTag) {
    action = actionTag[1] as ModerationAction['action'];
  }
  
  // Extract community ID from various tag formats
  let communityId = '';
  if (communityTag) {
    communityId = communityTag[1];
  } else if (aTag && aTag[1].startsWith('34550:')) {
    communityId = aTag[1];
  }
  
  const expiresAt = expiresTag ? parseInt(expiresTag[1]) : undefined;
  const duration = expiresAt ? expiresAt - event.created_at : undefined;
  
  return {
    id: event.id,
    moderatorPubkey: event.pubkey,
    action,
    targetPubkey: pTag?.[1],
    targetEventId: eTag?.[1],
    communityId,
    reason: reasonTag?.[1] || event.content,
    duration,
    expiresAt,
    createdAt: event.created_at,
    event,
  };
}

/**
 * Hook to fetch moderation logs for a community
 */
export function useModerationLogs(communityId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['moderation-logs', communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Query for various moderation event types
      const events = await nostr.query([
        {
          kinds: [5, 4550, 30078], // Deletion, approval, app-specific data
          '#a': [`34550:${communityId}`],
          limit: 200,
        },
        {
          kinds: [30078],
          '#community': [communityId],
          limit: 200,
        }
      ], { signal });

      const validEvents = events.filter(validateModerationEvent);
      const actions = validEvents.map(parseModerationEvent);
      
      // Sort by most recent first
      return actions.sort((a, b) => b.createdAt - a.createdAt);
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to get moderation statistics for a community
 */
export function useModerationStats(communityId: string) {
  const { data: logs } = useModerationLogs(communityId);

  if (!logs) {
    return {
      totalActions: 0,
      actionsByType: {} as Record<string, number>,
      actionsByModerator: {} as Record<string, number>,
      recentActions: [] as ModerationAction[],
    };
  }

  const actionsByType = logs.reduce((acc, log) => {
    acc[log.action] = (acc[log.action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const actionsByModerator = logs.reduce((acc, log) => {
    acc[log.moderatorPubkey] = (acc[log.moderatorPubkey] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const recentActions = logs.slice(0, 10);

  return {
    totalActions: logs.length,
    actionsByType,
    actionsByModerator,
    recentActions,
  };
}

/**
 * Hook to check if a user is currently banned or muted
 */
export function useUserModerationStatus(communityId: string, userPubkey: string) {
  const { data: logs } = useModerationLogs(communityId);

  if (!logs || !userPubkey) {
    return {
      isBanned: false,
      isMuted: false,
      banExpiry: undefined as number | undefined,
      muteExpiry: undefined as number | undefined,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  
  // Find most recent ban/mute actions for this user
  const userActions = logs.filter(log => log.targetPubkey === userPubkey);
  
  const latestBan = userActions
    .filter(log => log.action === 'ban')
    .sort((a, b) => b.createdAt - a.createdAt)[0];
    
  const latestMute = userActions
    .filter(log => log.action === 'mute')
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  const isBanned = latestBan && (!latestBan.expiresAt || latestBan.expiresAt > now);
  const isMuted = latestMute && (!latestMute.expiresAt || latestMute.expiresAt > now);

  return {
    isBanned: !!isBanned,
    isMuted: !!isMuted,
    banExpiry: latestBan?.expiresAt,
    muteExpiry: latestMute?.expiresAt,
  };
}