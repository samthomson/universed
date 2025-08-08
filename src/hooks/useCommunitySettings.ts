import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useNostrPublish } from './useNostrPublish';
import { useCommunities } from './useCommunities';
import type { NostrEvent } from '@nostrify/nostrify';

export interface CommunitySettings {
  requireApproval: boolean;
  allowAnonymous: boolean;
  moderationPolicy: 'strict' | 'moderate' | 'relaxed';
  maxPostLength: number;
  autoModeration: {
    enabled: boolean;
    spamDetection: boolean;
    profanityFilter: boolean;
    linkValidation: boolean;
  };
  notifications: {
    newMembers: boolean;
    newPosts: boolean;
    reports: boolean;
    mentions: boolean;
  };
}

export const DEFAULT_SETTINGS: CommunitySettings = {
  requireApproval: true, // Default to true as requested
  allowAnonymous: true,
  moderationPolicy: 'moderate',
  maxPostLength: 280,
  autoModeration: {
    enabled: false,
    spamDetection: true,
    profanityFilter: false,
    linkValidation: true,
  },
  notifications: {
    newMembers: true,
    newPosts: false,
    reports: true,
    mentions: true,
  },
};

function validateCommunitySettingsEvent(event: NostrEvent): boolean {
  if (event.kind !== 34552) return false; // Community settings kind
  const d = event.tags.find(([name]) => name === 'd')?.[1];
  return !!d;
}

function parseCommunitySettings(event: NostrEvent): CommunitySettings {
  const settings = { ...DEFAULT_SETTINGS };

  // Parse settings from tags
  event.tags.forEach(([name, value]) => {
    switch (name) {
      case 'require_approval':
        settings.requireApproval = value === 'true';
        break;
      case 'allow_anonymous':
        settings.allowAnonymous = value === 'true';
        break;
      case 'moderation_policy':
        if (['strict', 'moderate', 'relaxed'].includes(value)) {
          settings.moderationPolicy = value as 'strict' | 'moderate' | 'relaxed';
        }
        break;
      case 'max_post_length': {
        const length = parseInt(value);
        if (!isNaN(length) && length > 0) {
          settings.maxPostLength = length;
        }
        break;
      }
      case 'auto_moderation': {
        try {
          const autoMod = JSON.parse(value);
          if (typeof autoMod === 'object') {
            settings.autoModeration = { ...settings.autoModeration, ...autoMod };
          }
        } catch {
          // Ignore invalid JSON
        }
        break;
      }
      case 'notifications': {
        try {
          const notifications = JSON.parse(value);
          if (typeof notifications === 'object') {
            settings.notifications = { ...settings.notifications, ...notifications };
          }
        } catch {
          // Ignore invalid JSON
        }
        break;
      }
    }
  });

  return settings;
}

/**
 * Hook to get community settings for a specific community.
 * Returns default settings if no custom settings are found.
 */
export function useCommunitySettings(communityId: string | null) {
  const { nostr } = useNostr();
  const { data: communities } = useCommunities();

  return useQuery({
    queryKey: ['community-settings', communityId],
    queryFn: async (c) => {
      if (!communityId || !communities) return DEFAULT_SETTINGS;

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(2000)]);

      // Find the community to ensure it exists
      const community = communities.find(c => c.id === communityId);
      if (!community) return DEFAULT_SETTINGS;

      // Query for community settings
      const events = await nostr.query([
        {
          kinds: [34552], // Community settings kind
          '#d': [communityId],
          limit: 10,
        }
      ], { signal });

      const validSettingsEvents = events.filter(validateCommunitySettingsEvent);

      // Get the most recent settings event
      const latestSettingsEvent = validSettingsEvents
        .sort((a, b) => b.created_at - a.created_at)[0];

      if (latestSettingsEvent) {
        return parseCommunitySettings(latestSettingsEvent);
      }

      return DEFAULT_SETTINGS;
    },
    enabled: !!communityId && !!communities,
    staleTime: 1000 * 60 * 5, // 5 minutes - settings don't change frequently
  });
}

/**
 * Hook to update community settings.
 * Only community creators and moderators can update settings.
 */
export function useUpdateCommunitySettings(communityId: string) {
  const { mutateAsync: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { data: communities } = useCommunities();

  return useMutation({
    mutationFn: async (settings: Partial<CommunitySettings>) => {
      if (!communityId || !communities) {
        throw new Error('Community not found');
      }

      const community = communities.find(c => c.id === communityId);
      if (!community) {
        throw new Error('Community not found');
      }

      // Get current settings to merge with updates
      const currentSettings = queryClient.getQueryData(['community-settings', communityId]) as CommunitySettings || DEFAULT_SETTINGS;
      const updatedSettings = { ...currentSettings, ...settings };

      // Build tags for the settings event
      const tags = [
        ['d', communityId],
        ['require_approval', updatedSettings.requireApproval.toString()],
        ['allow_anonymous', updatedSettings.allowAnonymous.toString()],
        ['moderation_policy', updatedSettings.moderationPolicy],
        ['max_post_length', updatedSettings.maxPostLength.toString()],
        ['auto_moderation', JSON.stringify(updatedSettings.autoModeration)],
        ['notifications', JSON.stringify(updatedSettings.notifications)],
      ];

      await createEvent({
        kind: 34552, // Community settings kind
        content: '',
        tags,
      });

      return updatedSettings;
    },
    onSuccess: (updatedSettings) => {
      // Update the cache with the new settings
      queryClient.setQueryData(['community-settings', communityId], updatedSettings);

      // Invalidate related queries that depend on settings
      queryClient.invalidateQueries({ queryKey: ['approved-members', communityId] });
      queryClient.invalidateQueries({ queryKey: ['messages', communityId] });
    },
  });
}