import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo, useRef } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useSendDM } from '@/hooks/useSendDM';
import { useNostr } from '@nostrify/react';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { validateDMEvent } from '@/lib/dmUtils';
import { logger } from '@/lib/logger';
import { LOADING_PHASES, type LoadingPhase } from '@/lib/constants';
import type { NostrEvent } from '@/types/nostr';
import type { MessageProtocol } from '@/lib/dmConstants';
import { MESSAGE_PROTOCOL } from '@/lib/dmConstants';
import { nip57 } from 'nostr-tools';

// ============================================================================
// DataManager Types and Constants (co-located for better maintainability)
// ============================================================================

// Number of messages to load per pagination request
const MESSAGES_PER_PAGE = 5; // Default number of messages to load per page (lowered for testing)

// ============================================================================
// Messaging Domain Types
// ============================================================================

// Core participant data structure used throughout DataManager
interface ParticipantData {
  messages: DecryptedMessage[];
  lastActivity: number;
  lastMessage: DecryptedMessage | null;
  hasNIP4: boolean;
  hasNIP17: boolean;
}

// Messages state structure
type MessagesState = Map<string, ParticipantData>;

// Last sync timestamps for each protocol
interface LastSyncData {
  nip4: number | null;
  nip17: number | null;
}

// Subscription status for each protocol
interface SubscriptionStatus {
  nip4: boolean;
  nip17: boolean;
}

// Scan progress tracking
interface ScanProgress {
  current: number;
  status: string;
}

interface ScanProgressState {
  nip4: ScanProgress | null;
  nip17: ScanProgress | null;
}

// Debug information structure
interface DebugInfo {
  messageCount: number;
  nip4Count: number;
  nip17Count: number;
  nip4Sync: Date | null;
  nip17Sync: Date | null;
  nip17Enabled: boolean;
}

// Conversation summary structure
interface ConversationSummary {
  id: string;
  pubkey: string;
  lastMessage: DecryptedMessage | null;
  lastActivity: number;
  hasNIP4Messages: boolean;
  hasNIP17Messages: boolean;
  isKnown: boolean;
  isRequest: boolean;
  lastMessageFromUser: boolean;
}

// Message processing result
interface MessageProcessingResult {
  lastMessageTimestamp?: number;
  messageCount: number;
}

// Decryption result
interface DecryptionResult {
  decryptedContent: string;
  error?: string;
}

// Extended DecryptedMessage type
interface DecryptedMessage extends NostrEvent {
  decryptedContent?: string;
  error?: string;
  isSending?: boolean;
  clientFirstSeen?: number;
}

// NIP-17 processing result
interface NIP17ProcessingResult {
  processedMessage: DecryptedMessage;
  conversationPartner: string;
  error?: string;
}

// Constants for DataManager operations
const DATA_MANAGER_CONSTANTS = {
  // Logging prefixes
  LOG_PREFIX: 'DMS: DataManager:',
  CONVERSATION_LOG_PREFIX: 'DMS: useConversationMessages:',

  // Timing constants (in milliseconds)
  DEBOUNCED_WRITE_DELAY: 15000, // 15 seconds
  RECENT_MESSAGE_THRESHOLD: 5000, // 5 seconds
  SUBSCRIPTION_OVERLAP_SECONDS: 60, // 60 seconds
  NIP17_SETTING_CHANGE_DELAY: 500, // 500ms

  // Scanning limits
  SCAN_TOTAL_LIMIT: 20000,
  SCAN_BATCH_SIZE: 1000,

  // Query timeouts (in milliseconds)
  NIP4_QUERY_TIMEOUT: 15000, // 15 seconds
  NIP17_QUERY_TIMEOUT: 30000, // 30 seconds

  // Error logging debounce
  ERROR_LOG_DEBOUNCE_DELAY: 2000, // 2 seconds
} as const;

// Status messages for scan progress
const SCAN_STATUS_MESSAGES = {
  NIP4_STARTING: 'Starting NIP-4 scan...',
  NIP17_STARTING: 'Starting NIP-17 scan...',
  BATCH_COMPLETE: (batchNumber: number, messageCount: number) =>
    `Batch ${batchNumber} complete: ${messageCount} messages`,
} as const;



// Simple utility for debounced error logging
const createErrorLogger = (name: string) => {
  let count = 0;
  let timeout: NodeJS.Timeout | null = null;

  return (_error: Error) => {
    count++;

    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(() => {
      if (count > 0) {
        logger.error(`${DATA_MANAGER_CONSTANTS.LOG_PREFIX} ${name} processing complete with ${count} errors`);
        count = 0;
      }
    }, DATA_MANAGER_CONSTANTS.ERROR_LOG_DEBOUNCE_DELAY);
  };
};

// Create error loggers outside component to prevent recreation
const nip17ErrorLogger = createErrorLogger('NIP-17');

// Utility function to get tag value by name
const getTagValue = (event: NostrEvent, tagName: string): string | undefined => {
  return event.tags.find(([name]) => name === tagName)?.[1];
};

// Utility function to get all tag values by name
const getTagValues = (event: NostrEvent, tagName: string): string[] => {
  return event.tags.filter(([name]) => name === tagName).map(([, value]) => value);
};

// Utility function to get tag value with role filter
const getTagValueWithRole = (event: NostrEvent, tagName: string, role: string): string[] => {
  return event.tags
    .filter(([name, , , tagRole]) => name === tagName && tagRole === role)
    .map(([, value]) => value);
};

// Messaging domain interface
interface MessagingDomain {
  messages: MessagesState;
  isLoading: boolean;
  loadingPhase: LoadingPhase;
  isDoingInitialLoad: boolean;
  lastSync: LastSyncData;
  subscriptions: SubscriptionStatus;
  conversations: ConversationSummary[];
  getDebugInfo: () => DebugInfo;
  writeAllMessagesToStore: () => Promise<void>;
  resetMessageDataAndCache: () => Promise<void>;
  handleNIP17SettingChange: (enabled: boolean) => Promise<void>;
  sendMessage: (params: { recipientPubkey: string; content: string; protocol?: MessageProtocol }) => Promise<void>;
  isNIP17Enabled: boolean;
  isDebugging: boolean;
  scanProgress: ScanProgressState;
}

// ============================================================================
// Communities Domain Types
// ============================================================================

// Configuration constants
const ALWAYS_ADD_GENERAL_CHANNEL = true;
const CACHE_MESSAGES_LIMIT_PER_CHANNEL = MESSAGES_PER_PAGE;
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds

// Community metadata parsed from kind 34550 events
interface CommunityInfo {
  name: string; // from name tag
  description?: string; // from description tag
  image?: string; // from image tag
  banner?: string; // from banner tag
  moderators: string[]; // from p tags with role=moderator
  relays: string[]; // from relay tags
}

// Parsed member list from kind 34551/34552/34553 events
interface MembersList {
  members: string[]; // list of member pubkeys
  event: NostrEvent | null; // original event (can be null for combined lists)
  joinRequests?: NostrEvent[]; // actual join request events (kind 4552) for pending members
}

// Complete community data structure
export interface CommunityData {
  id: string; // community identifier (d tag)
  fullAddressableId: string; // full addressable format (34550:pubkey:identifier)
  pubkey: string; // community creator/owner
  info: CommunityInfo; // metadata from community definition
  definitionEvent: NostrEvent; // original kind 34550 community definition
  channels: Map<string, ChannelData>; // channelId -> channel data
  approvedMembers: MembersList | null; // parsed approved members list (kind 34551)
  pendingMembers: MembersList | null; // calculated: join requests (kind 4552) minus declined (kind 34552)
  declinedMembers: MembersList | null; // parsed declined members list (kind 34552)
  bannedMembers: MembersList | null; // parsed banned members list (kind 34553)
  membershipStatus: 'approved' | 'pending' | 'banned' | 'owner' | 'moderator'; // user's membership status
  lastActivity: number;
  isLoadingChannels?: boolean; // indicates if channels are still loading
}

// Channel metadata parsed from kind 32807 events
export interface ChannelInfo {
  name: string;
  description?: string;
  type: 'text' | 'voice';
  folderId?: string;
  position?: number; // Optional since it might be missing from JSON content
}

// Complete channel data structure
interface ChannelData {
  id: string; // Channel identifier from d tag (should be simple like "general", "design-team")
  communityId: string; // parent community id
  info: ChannelInfo; // parsed metadata from channel definition
  definition: NostrEvent; // original kind 32807 channel definition
  messages: NostrEvent[]; // kind 9411 messages
  replies: Map<string, NostrEvent[]>; // messageId -> replies (kind 1111)
  reactions: Map<string, NostrEvent[]>; // messageId -> reactions/zaps (kinds 7, 9735)
  pinnedMessages: NostrEvent[]; // pinned messages (kind 34554 events)
  permissions: NostrEvent | null; // kind 30143 permissions settings
  lastActivity: number;
  isLoadingData?: boolean; // indicates if channel data is still loading
  // Pagination state
  oldestMessageTimestamp?: number; // timestamp of oldest loaded message
  hasMoreMessages: boolean; // whether there are more messages to load
  isLoadingOlderMessages: boolean; // whether we're currently loading older messages
  reachedStartOfConversation: boolean; // whether we've reached the very beginning
}

// Communities state structure
type CommunitiesState = Map<string, CommunityData>; // communityId -> community data

// Community loading breakdown for performance tracking
interface CommunityLoadBreakdown {
  step1_communities: {
    total: number;
    membershipQuery: number;
    definitionsQuery: number;
  };
  step2_parallel_batch1: {
    total: number;
    channelsQuery: number;
    membersQuery: number;
    joinRequestsQuery: number;
  };
  step3_parallel_batch2: {
    total: number;
    permissionsQuery: number;
    messagesQuery: number;
  };
  step4_replies_batch: {
    total: number;
    repliesQuery: number;
    reactionsQuery: number;
  };
  step5_pinned_batch: {
    total: number;
    pinnedQuery: number;
  };
  total: number;
}

// Folder information extracted from channels
export interface ChannelFolder {
  id: string;
  name: string;
  description?: string;
  position: number;
  communityId: string;
  creator: string;
  channels: DisplayChannel[]; // Channels in this folder
}

// Helper interface for channel display (matching useChannels format but with cached permissions)
export interface DisplayChannel {
  id: string; // Simple channel name for URLs (e.g., "general", "design-team")
  name: string;
  description?: string;
  type: 'text' | 'voice';
  communityId: string;
  creator: string;
  folderId?: string;
  position: number;
  event: NostrEvent;
  permissions?: NostrEvent | null; // Include cached permissions to avoid additional queries
  isLoading?: boolean; // True when channel is being created (optimistic)
  hasAccess: boolean; // Pre-computed access check - REQUIRED, no fallback
  parsedPermissions: {
    readPermissions: 'everyone' | 'members' | 'moderators' | 'specific';
    writePermissions: 'everyone' | 'members' | 'moderators' | 'specific';
  }; // Pre-parsed permissions - REQUIRED
  isRestricted: boolean; // Pre-computed restriction check - REQUIRED
}

// Communities domain interface
interface CommunitiesDomain {
  communities: CommunitiesState;
  isLoading: boolean;
  loadingPhase: LoadingPhase;
  loadTime: number | null;
  loadBreakdown: CommunityLoadBreakdown | null;
  getDebugInfo: () => {
    communityCount: number;
    channelCount: number;
    messageCount: number;
    replyCount: number;
    reactionCount: number;
    pinnedCount: number;
  };
  getSortedChannels: (communityId: string) => DisplayChannel[];
  getFolders: (communityId: string) => ChannelFolder[];
  getChannelsWithoutFolder: (communityId: string) => { text: DisplayChannel[]; voice: DisplayChannel[] };
  addOptimisticMessage: (communityId: string, channelId: string, content: string, additionalTags?: string[][]) => NostrEvent | null;
  addOptimisticChannel: (communityId: string, channelName: string, channelType: 'text' | 'voice', folderId?: string, position?: number) => void;
  deleteChannelImmediately: (communityId: string, channelId: string) => void;
  loadOlderMessages: (communityId: string, channelId: string) => Promise<void>;
  resetCommunitiesDataAndCache: () => Promise<void>;
  useDataManagerPinnedMessages: (communityId: string | null, channelId: string | null) => NostrEvent[];
  approveMember: (communityId: string, memberPubkey: string) => Promise<void>;
  declineMember: (communityId: string, memberPubkey: string) => Promise<void>;
  banMember: (communityId: string, memberPubkey: string) => Promise<void>;
}

// Main DataManager interface - organized by domain
interface DataManagerContextType {
  messaging: MessagingDomain;
  communities: CommunitiesDomain;
}

const DataManagerContext = createContext<DataManagerContextType | null>(null);

export function useDataManager(): DataManagerContextType {
  const context = useContext(DataManagerContext);
  if (!context) {
    throw new Error('useDataManager must be used within DataManagerProvider');
  }
  return context;
}

// Hook for conversation-specific message subscriptions to avoid unnecessary re-renders
export function useConversationMessages(conversationId: string) {
  const { messaging } = useDataManager();
  const { messages: allMessages } = messaging;

  logger.log(`${DATA_MANAGER_CONSTANTS.CONVERSATION_LOG_PREFIX} Hook called for conversation ${conversationId}, total conversations in state: ${allMessages.size}`);

  return useMemo(() => {
    const conversationData = allMessages.get(conversationId);

    if (!conversationData) {
      logger.log(`${DATA_MANAGER_CONSTANTS.CONVERSATION_LOG_PREFIX} No data for conversation ${conversationId}`);
      return {
        messages: [],
        hasMoreMessages: false,
        totalCount: 0,
        lastMessage: null,
        lastActivity: 0,
      };
    }

    logger.log(`${DATA_MANAGER_CONSTANTS.CONVERSATION_LOG_PREFIX} Returning ${conversationData.messages.length} messages for conversation ${conversationId}`);

    // Log the last few messages to help debug
    if (conversationData.messages.length > 0) {
      const lastMessages = conversationData.messages.slice(-3);
      logger.log(`${DATA_MANAGER_CONSTANTS.CONVERSATION_LOG_PREFIX} Last 3 messages:`, lastMessages.map(m => ({
        id: m.id.slice(0, 8) + '...',
        content: m.content.slice(0, 30) + (m.content.length > 30 ? '...' : ''),
        created_at: new Date(m.created_at * 1000).toISOString()
      })));
    }

    return {
      messages: conversationData.messages,
      hasMoreMessages: false, // This will be handled by pagination logic
      totalCount: conversationData.messages.length,
      lastMessage: conversationData.lastMessage,
      lastActivity: conversationData.lastActivity,
    };
  }, [allMessages, conversationId]);
}

// Hook for retrieving a specific channel with its data from DataManager
export function useDataManagerCommunityChannel(communityId: string | null, channelId: string | null) {
  const { communities } = useDataManager();

  return useMemo(() => {
    if (!communityId || !channelId) {
      return {
        isLoading: false,
        channel: null
      };
    }

    // Extract simple community ID from full addressable format
    const simpleCommunityId = (() => {
      if (communityId.includes(':')) {
        const parts = communityId.split(':');
        return parts[2] || parts[parts.length - 1];
      }
      return communityId;
    })();

    // Get the community
    const community = communities.communities.get(simpleCommunityId);
    if (!community) {
      logger.log('Communities: Community not found:', { communityId, simpleCommunityId, decodedId: simpleCommunityId });
      return {
        isLoading: false,
        channel: null
      };
    }

    // Get the channel
    const channelData = community.channels.get(channelId);
    if (!channelData) {
      logger.log('Communities: Channel not found:', {
        channelId,
        communityId: simpleCommunityId,
        availableChannels: Array.from(community.channels.keys()),
        channelsCount: community.channels.size
      });
      return {
        isLoading: false,
        channel: null
      };
    }

    // Create a DisplayChannel object that matches the format used throughout the app
    // We'll use a simplified approach since we don't have direct access to the helper functions

    // Try to parse permissions from the event
    let readPermissions: 'everyone' | 'members' | 'moderators' | 'specific' = 'everyone';
    let writePermissions: 'everyone' | 'members' | 'moderators' | 'specific' = 'members';

    if (channelData.permissions) {
      try {
        const content = JSON.parse(channelData.permissions.content);
        if (content.readPermissions === 'everyone' ||
          content.readPermissions === 'members' ||
          content.readPermissions === 'moderators' ||
          content.readPermissions === 'specific') {
          readPermissions = content.readPermissions;
        }

        if (content.writePermissions === 'everyone' ||
          content.writePermissions === 'members' ||
          content.writePermissions === 'moderators' ||
          content.writePermissions === 'specific') {
          writePermissions = content.writePermissions;
        }
      } catch {
        // Use default permissions if parsing fails
      }
    }

    const parsedPermissions = {
      readPermissions,
      writePermissions
    };

    // Determine if the channel has access restrictions
    const isRestricted =
      readPermissions === 'moderators' ||
      readPermissions === 'specific' ||
      writePermissions === 'moderators' ||
      writePermissions === 'specific';

    // Create the DisplayChannel object with messages included
    // Ensure messages are sorted by timestamp (oldest first)
    const sortedMessages = [...channelData.messages].sort((a, b) => a.created_at - b.created_at);

    const channel: DisplayChannel & { messages: NostrEvent[] } = {
      id: channelData.id,
      name: channelData.info.name,
      description: channelData.info.description,
      type: channelData.info.type,
      communityId: channelData.communityId,
      creator: channelData.definition.pubkey,
      position: channelData.info.position ?? 0,
      folderId: channelData.info.folderId,
      event: channelData.definition,
      permissions: channelData.permissions,
      hasAccess: true, // Assume access is granted for simplicity
      parsedPermissions,
      isRestricted,
      messages: sortedMessages // Include sorted messages in the channel object
    };

    // Return just the channel with messages included
    return {
      isLoading: false,
      channel
    };
  }, [communities.communities, communityId, channelId]);
}

// Hook to get reactions for a specific message from DataManager
export function useDataManagerMessageReactions(communityId: string | null, channelId: string | null, messageId: string | null) {
  const { communities } = useDataManager();

  return useMemo(() => {
    if (!communityId || !channelId || !messageId) {
      return {
        reactions: [],
        zaps: [],
        reactionGroups: {},
        totalSats: 0,
        zapCount: 0
      };
    }

    // Extract simple community ID from full addressable format
    const simpleCommunityId = (() => {
      if (communityId.includes(':')) {
        const parts = communityId.split(':');
        return parts[2] || parts[parts.length - 1];
      }
      return communityId;
    })();

    // Get the community and channel
    const community = communities.communities.get(simpleCommunityId);
    if (!community) {
      return {
        reactions: [],
        zaps: [],
        reactionGroups: {},
        totalSats: 0,
        zapCount: 0
      };
    }

    const channelData = community.channels.get(channelId);
    if (!channelData) {
      return {
        reactions: [],
        zaps: [],
        reactionGroups: {},
        totalSats: 0,
        zapCount: 0
      };
    }

    // Get reactions for this message
    const messageReactions = channelData.reactions.get(messageId) || [];

    // Separate reactions and zaps
    const reactions = messageReactions.filter(r => r.kind === 7);
    const zaps = messageReactions.filter(r => r.kind === 9735);

    // Group reactions by emoji
    const reactionGroups = reactions.reduce((acc, reaction) => {
      const emoji = reaction.content || "👍";
      if (!acc[emoji]) {
        acc[emoji] = [];
      }
      acc[emoji].push(reaction);
      return acc;
    }, {} as Record<string, NostrEvent[]>);

    // Calculate zap totals
    let zapCount = 0;
    let totalSats = 0;

    zaps.forEach(zap => {
      zapCount++;

      // Try multiple methods to extract the amount:
      // Method 1: amount tag (from zap request, sometimes copied to receipt)
      const amountTag = zap.tags.find(([name]) => name === 'amount')?.[1];
      if (amountTag) {
        const millisats = parseInt(amountTag);
        totalSats += Math.floor(millisats / 1000);
        return;
      }

      // Method 2: Extract from bolt11 invoice
      const bolt11Tag = zap.tags.find(([name]) => name === 'bolt11')?.[1];
      if (bolt11Tag) {
        try {
          const invoiceSats = nip57.getSatoshisAmountFromBolt11(bolt11Tag);
          totalSats += invoiceSats;
          return;
        } catch (error) {
          console.warn('Failed to parse bolt11 amount:', error);
        }
      }

      // Method 3: Parse from description (zap request JSON)
      const descriptionTag = zap.tags.find(([name]) => name === 'description')?.[1];
      if (descriptionTag) {
        try {
          const zapRequest = JSON.parse(descriptionTag);
          const requestAmountTag = zapRequest.tags?.find(([name]: string[]) => name === 'amount')?.[1];
          if (requestAmountTag) {
            const millisats = parseInt(requestAmountTag);
            totalSats += Math.floor(millisats / 1000);
            return;
          }
        } catch (error) {
          console.warn('Failed to parse description JSON:', error);
        }
      }

      console.warn('Could not extract amount from zap receipt:', zap.id);
    });

    return {
      reactions,
      zaps,
      reactionGroups,
      totalSats,
      zapCount
    };
  }, [communities.communities, communityId, channelId, messageId]);
}

// Hook to get pinned messages for a specific channel from DataManager
export function useDataManagerPinnedMessages(communityId: string | null, channelId: string | null) {
  const { communities } = useDataManager();

  return useMemo(() => {
    if (!communityId || !channelId) {
      return [];
    }

    const simpleCommunityId = (() => {
      if (communityId.includes(':')) {
        const parts = communityId.split(':');
        return parts[2] || parts[parts.length - 1];
      }
      return communityId;
    })();

    const community = communities.communities.get(simpleCommunityId);
    if (!community) {
      return [];
    }

    const channelData = community.channels.get(channelId);
    if (!channelData) {
      return [];
    }

    return channelData.pinnedMessages;
  }, [communities.communities, communityId, channelId]);
}

// Hook to get join requests (pending members) from DataManager
export function useDataManagerJoinRequests(communityId: string | null) {
  const { communities } = useDataManager();

  return useMemo(() => {
    if (!communityId) {
      return {
        data: [],
        isLoading: false,
      };
    }

    const community = communities.communities.get(communityId);
    if (!community) {
      return {
        data: [],
        isLoading: communities.isLoading,
      };
    }

    // Get pending members from the community data
    const pendingMembers = community.pendingMembers?.members || [];
    const joinRequestEvents = community.pendingMembers?.joinRequests || [];

    // Create a map of pubkey to join request event for efficient lookup
    const joinRequestMap = new Map<string, NostrEvent>();
    joinRequestEvents.forEach(event => {
      joinRequestMap.set(event.pubkey, event);
    });

    // Transform into the format expected by the UI (similar to useJoinRequests)
    const joinRequests = pendingMembers.map(pubkey => {
      const joinRequestEvent = joinRequestMap.get(pubkey);
      return {
        requesterPubkey: pubkey,
        message: joinRequestEvent?.content || '', // Use actual join request message
        createdAt: joinRequestEvent?.created_at || community.pendingMembers?.event?.created_at || Math.floor(Date.now() / 1000),
      };
    });


    return {
      data: joinRequests,
      isLoading: false,
    };
  }, [communities.communities, communities.isLoading, communityId]);
}

// Hook to get community members from DataManager instead of making separate network requests
export function useDataManagerCommunityMembers(communityId: string | null) {
  const { communities } = useDataManager();

  return useMemo(() => {
    if (!communityId) {
      return {
        data: [],
        isLoading: false,
      };
    }

    const community = communities.communities.get(communityId);
    if (!community) {
      return {
        data: [],
        isLoading: communities.isLoading,
      };
    }

    const members: Array<{
      pubkey: string;
      role: 'owner' | 'moderator' | 'member';
      isOnline: boolean;
      joinedAt?: number;
    }> = [];
    const addedMembers = new Set<string>();

    // Add community creator as owner
    if (!addedMembers.has(community.pubkey)) {
      members.push({
        pubkey: community.pubkey,
        role: 'owner',
        isOnline: false, // We don't have online status in DataManager yet
        joinedAt: community.definitionEvent.created_at,
      });
      addedMembers.add(community.pubkey);
    }

    // Add moderators
    community.info.moderators.forEach(modPubkey => {
      if (!addedMembers.has(modPubkey)) {
        members.push({
          pubkey: modPubkey,
          role: 'moderator',
          isOnline: false, // We don't have online status in DataManager yet
        });
        addedMembers.add(modPubkey);
      }
    });

    // Add approved members (excluding banned ones)
    const bannedMemberPubkeys = new Set(community.bannedMembers?.members || []);


    if (community.approvedMembers) {
      community.approvedMembers.members.forEach(memberPubkey => {
        if (!addedMembers.has(memberPubkey) && !bannedMemberPubkeys.has(memberPubkey)) {
          members.push({
            pubkey: memberPubkey,
            role: 'member',
            isOnline: false, // We don't have online status in DataManager yet
          });
          addedMembers.add(memberPubkey);
        }
      });
    }

    // Sort by role priority, then by pubkey
    const sortedMembers = members.sort((a, b) => {
      const roleOrder = { owner: 0, moderator: 1, member: 2 };
      const roleComparison = roleOrder[a.role] - roleOrder[b.role];
      if (roleComparison !== 0) return roleComparison;

      // Then by online status (when we have it)
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;

      // Then alphabetically by pubkey
      return a.pubkey.localeCompare(b.pubkey);
    });


    return {
      data: sortedMembers,
      isLoading: false,
    };
  }, [communityId, communities]);
}

// Hook to get the current user's membership status in a community from DataManager
export function useDataManagerUserMembership(communityId: string | null) {
  const { communities } = useDataManager();

  return useMemo(() => {
    if (!communityId) {
      return {
        data: 'not-member' as const,
        isLoading: false,
      };
    }

    const community = communities.communities.get(communityId);
    if (!community) {
      return {
        data: communities.isLoading ? undefined : 'not-member' as const,
        isLoading: communities.isLoading,
      };
    }

    // Map DataManager membership status to expected format
    const membershipStatus = (() => {
      switch (community.membershipStatus) {
        case 'approved':
        case 'pending':
        case 'banned':
        case 'owner':
        case 'moderator':
          return community.membershipStatus;
        default:
          return 'not-member' as const;
      }
    })();

    return {
      data: membershipStatus,
      isLoading: false,
    };
  }, [communityId, communities]);
}

// Hook to get the current user's role in a community from DataManager
export function useDataManagerUserRole(communityId: string, userPubkey?: string) {
  const { communities } = useDataManager();
  const { user } = useCurrentUser();

  const targetPubkey = userPubkey || user?.pubkey;

  return useMemo(() => {
    if (!targetPubkey || !communityId) {
      return { role: 'member' as const, hasModeratorAccess: false };
    }

    const community = communities.communities.get(communityId);
    if (!community) {
      return { role: 'member' as const, hasModeratorAccess: false };
    }

    // Check if user is the community owner
    if (community.pubkey === targetPubkey) {
      return { role: 'owner' as const, hasModeratorAccess: true };
    }

    // Check if user is a moderator
    if (community.info.moderators.includes(targetPubkey)) {
      return { role: 'moderator' as const, hasModeratorAccess: true };
    }

    return { role: 'member' as const, hasModeratorAccess: false };
  }, [communityId, targetPubkey, communities]);
}

// Hook to check if current user can perform moderation actions from DataManager
export function useDataManagerCanModerate(communityId: string) {
  const { user } = useCurrentUser();
  const { role, hasModeratorAccess } = useDataManagerUserRole(communityId, user?.pubkey);

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

interface DataManagerProviderProps {
  children: ReactNode;
}

export function DataManagerProvider({ children }: DataManagerProviderProps) {
  const { user } = useCurrentUser();
  const { settings } = useUserSettings();
  const { nostr } = useNostr();
  const { sendNIP4Message, sendNIP17Message } = useSendDM();
  const { mutateAsync: createEvent } = useNostrPublish();

  // Memoize the user pubkey to prevent unnecessary re-renders
  const userPubkey = useMemo(() => user?.pubkey, [user?.pubkey]);

  const [messages, setMessages] = useState<MessagesState>(new Map());
  const [lastSync, setLastSync] = useState<LastSyncData>({
    nip4: null,
    nip17: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>(LOADING_PHASES.IDLE);
  const [subscriptions, setSubscriptions] = useState<SubscriptionStatus>({
    nip4: false,
    nip17: false
  });

  // Track whether initial load has already completed
  const [hasInitialLoadCompleted, setHasInitialLoadCompleted] = useState(false);

  // Track whether we should save immediately (for relay messages)
  const [shouldSaveImmediately, setShouldSaveImmediately] = useState(false);

  // Track scan progress for user feedback
  const [scanProgress, setScanProgress] = useState<ScanProgressState>({
    nip4: null,
    nip17: null
  });

  // Subscription refs for real-time message processing
  const nip4SubscriptionRef = useRef<{ close: () => void } | null>(null);
  const nip17SubscriptionRef = useRef<{ close: () => void } | null>(null);

  // Community messages subscription ref
  const communityMessagesSubscriptionRef = useRef<{ close: () => void } | null>(null);

  // Community management subscription ref (for membership changes, etc.)
  const communityManagementSubscriptionRef = useRef<{ close: () => void } | null>(null);

  // Communities state
  const [communities, setCommunities] = useState<CommunitiesState>(new Map());
  const [communitiesLoading, setCommunitiesLoading] = useState(false);
  const [communitiesLoadingPhase, setCommunitiesLoadingPhase] = useState<LoadingPhase>(LOADING_PHASES.IDLE);
  const [communitiesLoadTime, setCommunitiesLoadTime] = useState<number | null>(null);
  const [communitiesLoadBreakdown, setCommunitiesLoadBreakdown] = useState<CommunityLoadBreakdown | null>(null);
  const [communitiesLastSync, setCommunitiesLastSync] = useState<number | null>(null);

  // Track whether we should save communities immediately (for network loads)
  const [shouldSaveCommunitiesImmediately, setShouldSaveCommunitiesImmediately] = useState(false);

  // Single, deterministic message loading - happens exactly once when provider initializes
  useEffect(() => {
    logger.log('DMS: DataManager: Main effect triggered with:', { userPubkey, hasInitialLoadCompleted, isLoading });

    if (!userPubkey) {
      logger.log('DMS: DataManager: No user pubkey available, skipping message loading');
      return;
    }

    if (hasInitialLoadCompleted) {
      logger.log('DMS: DataManager: Initial load already completed, skipping duplicate request');
      return;
    }

    if (isLoading) {
      logger.log('DMS: DataManager: Message loading already in progress, skipping duplicate request');
      return;
    }

    logger.log('DMS: DataManager: Starting initial message loading process');
    startMessageLoading();
  }, [userPubkey, hasInitialLoadCompleted, isLoading]); // Only depend on user pubkey - settings are handled separately

  // Separate effect for cleanup when user changes
  useEffect(() => {
    return () => {
      // Only clean up subscriptions when the user pubkey changes (component unmounts or user switches)
      if (nip4SubscriptionRef.current) {
        nip4SubscriptionRef.current.close();
        nip4SubscriptionRef.current = null;
        logger.log('DMS: DataManager: Cleaned up NIP-4 subscription during user change cleanup');
      }
      if (nip17SubscriptionRef.current) {
        nip17SubscriptionRef.current.close();
        nip17SubscriptionRef.current = null;
        logger.log('DMS: DataManager: Cleaned up NIP-17 subscription during user change cleanup');
      }
    };
  }, [userPubkey]); // Only depend on userPubkey for cleanup



  // Load past NIP-4 messages from relays (following useNIP4DirectMessages pattern)
  const loadPastNIP4Messages = useCallback(async (sinceTimestamp?: number) => {
    logger.log(`DMS: DataManager: Loading past NIP-4 messages since ${sinceTimestamp ? new Date(sinceTimestamp * 1000).toISOString() : 'beginning'}`);
    logger.log(`DMS: DataManager: NIP-4 Debug - User pubkey: ${user?.pubkey?.slice(0, 8)}..., Signer available: ${!!user?.signer?.nip04}`);

    // Note: We'll fetch messages even without a signer, but they won't be decrypted
    if (!user?.pubkey) {
      logger.error('DMS: DataManager: No user pubkey available');
      return;
    }

    let allMessages: NostrEvent[] = [];
    let processedMessages = 0;
    let currentSince = sinceTimestamp || 0;
    const SCAN_TOTAL_LIMIT = DATA_MANAGER_CONSTANTS.SCAN_TOTAL_LIMIT;
    const SCAN_BATCH_SIZE = DATA_MANAGER_CONSTANTS.SCAN_BATCH_SIZE;

    logger.log(`DMS: DataManager: Starting NIP-4 batch processing (limit: ${SCAN_TOTAL_LIMIT}, batch: ${SCAN_BATCH_SIZE})`);

    // Initialize scan progress
    setScanProgress(prev => ({ ...prev, nip4: { current: 0, status: SCAN_STATUS_MESSAGES.NIP4_STARTING } }));

    while (processedMessages < SCAN_TOTAL_LIMIT) {
      const batchLimit = Math.min(SCAN_BATCH_SIZE, SCAN_TOTAL_LIMIT - processedMessages);

      // Build filters for this batch - same as useNIP4DirectMessages
      const filters = [
        {
          kinds: [4],
          '#p': [user.pubkey],
          limit: batchLimit,
          since: currentSince
        },
        {
          kinds: [4],
          authors: [user.pubkey],
          limit: batchLimit,
          since: currentSince
        }
      ];

      logger.log(`DMS: DataManager: NIP-4 Batch ${Math.floor(processedMessages / SCAN_BATCH_SIZE) + 1}: requesting ${batchLimit} messages since ${new Date(currentSince * 1000).toISOString()}`);

      try {
        logger.log(`DMS: DataManager: NIP-4 Querying filters:`, JSON.stringify(filters, null, 2));
        const batchDMs = await nostr.query(filters, { signal: AbortSignal.timeout(DATA_MANAGER_CONSTANTS.NIP4_QUERY_TIMEOUT) });
        logger.log(`DMS: DataManager: NIP-4 Raw response: ${batchDMs.length} events`);

        const validBatchDMs = batchDMs.filter(validateDMEvent);
        logger.log(`DMS: DataManager: NIP-4 After validation: ${validBatchDMs.length} valid events`);

        if (validBatchDMs.length === 0) {
          logger.log('DMS: DataManager: NIP-4 No more messages available, stopping scan');
          break;
        }

        allMessages = [...allMessages, ...validBatchDMs];
        processedMessages += validBatchDMs.length;

        // Update scan progress
        setScanProgress(prev => ({
          ...prev,
          nip4: {
            current: allMessages.length,
            status: `Batch ${Math.floor(processedMessages / SCAN_BATCH_SIZE) + 1} complete: ${validBatchDMs.length} messages`
          }
        }));

        // Update currentSince for next batch using the correct timestamp coordination logic
        // Find the OLDEST timestamp from EACH query separately
        const oldestToMe = validBatchDMs.filter(m => m.pubkey !== user.pubkey).length > 0
          ? Math.min(...validBatchDMs.filter(m => m.pubkey !== user.pubkey).map(m => m.created_at))
          : Infinity;
        const oldestFromMe = validBatchDMs.filter(m => m.pubkey === user.pubkey).length > 0
          ? Math.min(...validBatchDMs.filter(m => m.pubkey === user.pubkey).map(m => m.created_at))
          : Infinity;

        // Use the EARLIER timestamp to ensure no gaps between batches
        const oldestInBatch = Math.min(oldestToMe, oldestFromMe);
        if (oldestInBatch !== Infinity) {
          currentSince = oldestInBatch; // Next batch starts from the EARLIER timestamp
          logger.log(`DMS: DataManager: NIP-4 Batch timestamp coordination: oldestToMe: ${oldestToMe !== Infinity ? new Date(oldestToMe * 1000).toISOString() : 'none'}, oldestFromMe: ${oldestFromMe !== Infinity ? new Date(oldestFromMe * 1000).toISOString() : 'none'}, next batch since: ${new Date(currentSince * 1000).toISOString()}`);
        }

        logger.log(`DMS: DataManager: NIP-4 Batch complete: ${validBatchDMs.length} messages, total: ${allMessages.length}`);

        // Stop if we got fewer messages than requested (end of data)
        if (validBatchDMs.length < batchLimit * 2) { // *2 because we have 2 filters
          logger.log('DMS: DataManager: NIP-4 Reached end of available messages');
          break;
        }
      } catch (error) {
        logger.error('DMS: DataManager: NIP-4 Error in batch query:', error);
        break;
      }
    }

    logger.log(`DMS: DataManager: NIP-4 Scan complete: ${allMessages.length} total messages processed`);

    // Clear scan progress when complete
    setScanProgress(prev => ({ ...prev, nip4: null }));

    return allMessages;
  }, [user, nostr]);

  // Load past NIP-17 messages from relays (following useNIP17DirectMessages pattern)
  const loadPastNIP17Messages = useCallback(async (sinceTimestamp?: number) => {
    logger.log(`DMS: DataManager: Loading past NIP-17 messages since ${sinceTimestamp ? new Date(sinceTimestamp * 1000).toISOString() : 'beginning'}`);

    // Note: We'll fetch messages even without a signer, but they won't be decrypted
    if (!user?.pubkey) {
      logger.error('DMS: DataManager: No user pubkey available');
      return;
    }

    let allNIP17Events: NostrEvent[] = [];
    let processedMessages = 0;
    let currentSince = sinceTimestamp || 0;
    const SCAN_TOTAL_LIMIT = DATA_MANAGER_CONSTANTS.SCAN_TOTAL_LIMIT;
    const SCAN_BATCH_SIZE = DATA_MANAGER_CONSTANTS.SCAN_BATCH_SIZE;

    logger.log(`DMS: DataManager: Starting NIP-17 batch processing (limit: ${SCAN_TOTAL_LIMIT}, batch: ${SCAN_BATCH_SIZE})`);

    // Initialize scan progress
    setScanProgress(prev => ({ ...prev, nip17: { current: 0, status: SCAN_STATUS_MESSAGES.NIP17_STARTING } }));

    while (processedMessages < SCAN_TOTAL_LIMIT) {
      const batchLimit = Math.min(SCAN_BATCH_SIZE, SCAN_TOTAL_LIMIT - processedMessages);

      // NIP-17: Query Kind 1059 (Gift Wrap) messages where we're the recipient
      const filters = [
        {
          kinds: [1059],
          '#p': [user.pubkey], // We are the recipient
          limit: batchLimit,
          since: currentSince
        }
      ];

      logger.log(`DMS: DataManager: NIP-17 Batch ${Math.floor(processedMessages / SCAN_BATCH_SIZE) + 1}: requesting ${batchLimit} Gift Wrap messages since ${new Date(currentSince * 1000).toISOString()}`);

      try {
        logger.log(`DMS: DataManager: NIP-17 Querying filters:`, JSON.stringify(filters, null, 2));
        const batchEvents = await nostr.query(filters, { signal: AbortSignal.timeout(DATA_MANAGER_CONSTANTS.NIP17_QUERY_TIMEOUT) });
        logger.log(`DMS: DataManager: NIP-17 Raw response: ${batchEvents.length} events`);

        if (batchEvents.length === 0) {
          logger.log('DMS: DataManager: NIP-17 No more Gift Wrap messages available, stopping scan');
          break;
        }

        allNIP17Events = [...allNIP17Events, ...batchEvents];
        processedMessages += batchEvents.length;

        // Update scan progress
        setScanProgress(prev => ({
          ...prev,
          nip17: {
            current: allNIP17Events.length,
            status: `Batch ${Math.floor(processedMessages / SCAN_BATCH_SIZE) + 1} complete: ${batchEvents.length} messages`
          }
        }));

        // Update currentSince for next batch (NIP-17 only has one filter, so simpler)
        if (batchEvents.length > 0) {
          const oldestInBatch = Math.min(...batchEvents.map(m => m.created_at));
          currentSince = oldestInBatch; // Next batch starts from where this one ended
          logger.log(`DMS: DataManager: NIP-17 Batch timestamp coordination: oldest in batch: ${new Date(oldestInBatch * 1000).toISOString()}, next batch since: ${new Date(currentSince * 1000).toISOString()}`);
        }

        logger.log(`DMS: DataManager: NIP-17 Batch complete: ${batchEvents.length} Gift Wrap messages, total: ${allNIP17Events.length}`);

        // Stop if we got fewer messages than requested (end of data)
        if (batchEvents.length < batchLimit) {
          logger.log('DMS: DataManager: NIP-17 Reached end of available Gift Wrap messages');
          break;
        }
      } catch (error) {
        logger.error('DMS: DataManager: NIP-17 Error in batch query:', error);
        break;
      }
    }

    logger.log(`DMS: DataManager: NIP-17 Scan complete: ${allNIP17Events.length} total Gift Wrap messages processed`);

    // Clear scan progress when complete
    setScanProgress(prev => ({ ...prev, nip17: null }));

    return allNIP17Events;
  }, [user, nostr]);

  // Stage 1: Read all past messages from storage for a specific protocol
  const loadPreviousCachedMessages = useCallback(async (protocol: MessageProtocol): Promise<number | undefined> => {
    const startTime = Date.now();
    logger.log(`DMS: DataManager: [${protocol.toUpperCase()}] Stage 1 - Loading past messages from storage`);

    // Skip NIP-17 if it's disabled
    if (protocol === MESSAGE_PROTOCOL.NIP17 && !settings.enableNIP17) {
      logger.log('DMS: DataManager: NIP-17 disabled, skipping message loading');
      return undefined;
    }

    // Ensure we have a user pubkey
    if (!userPubkey) {
      logger.log('DMS: DataManager: No user pubkey available, skipping message loading');
      return undefined;
    }

    try {
      // First, read any cached messages from IndexedDB to get the newest timestamp
      let sinceTimestamp: number | undefined;
      let dbReadTime: number;
      try {
        const dbStartTime = Date.now();
        const { readMessagesFromDB } = await import('@/lib/messageStore');
        const cachedStore = await readMessagesFromDB(userPubkey);
        dbReadTime = Date.now() - dbStartTime;

        if (cachedStore && Object.keys(cachedStore.participants).length > 0) {
          logger.log(`DMS: DataManager: ✅ Found cached store with ${Object.keys(cachedStore.participants).length} participants (${dbReadTime}ms)`);

          // Filter participants based on NIP-17 setting
          const filteredParticipants = settings.enableNIP17
            ? cachedStore.participants
            : Object.fromEntries(
              Object.entries(cachedStore.participants).filter(([_, participant]) =>
                !participant.hasNIP17
              )
            );

          // Use the actual lastSync timestamps from the stored data, not recalculated from messages
          if (protocol === MESSAGE_PROTOCOL.NIP04 && cachedStore.lastSync.nip4) {
            sinceTimestamp = cachedStore.lastSync.nip4;
            logger.log(`DMS: DataManager: Using stored NIP-4 lastSync timestamp: ${new Date(sinceTimestamp * 1000).toISOString()}`);
          } else if (protocol === MESSAGE_PROTOCOL.NIP17 && cachedStore.lastSync.nip17) {
            sinceTimestamp = cachedStore.lastSync.nip17;
            logger.log(`DMS: DataManager: Using stored NIP-17 lastSync timestamp: ${new Date(sinceTimestamp * 1000).toISOString()}`);
          }

          let totalMessages = 0;
          let filteredOutCount = 0;

          Object.values(filteredParticipants).forEach(participant => {
            totalMessages += participant.messages.length;
          });

          filteredOutCount = Object.keys(cachedStore.participants).length - Object.keys(filteredParticipants).length;

          logger.log(`DMS: DataManager: Found ${totalMessages} cached messages (${filteredOutCount} NIP-17 participants filtered out)`);

          // Load filtered cached messages into state
          const newState = new Map();
          for (const [participantPubkey, participant] of Object.entries(filteredParticipants)) {
            // Messages from IndexedDB are encrypted - decrypt them on read
            const processedMessages = await Promise.all(participant.messages.map(async (msg) => {
              // Check if this is an encrypted message that needs decryption
              if (msg.kind === 4) {
                // NIP-4 message - decrypt it
                const isFromUser = msg.pubkey === user?.pubkey;
                const recipientPTag = msg.tags?.find(([name]) => name === 'p')?.[1];
                const otherPubkey = isFromUser ? recipientPTag : msg.pubkey;

                if (otherPubkey && otherPubkey !== user?.pubkey) {
                  const { decryptedContent, error } = await decryptNIP4Message(msg, otherPubkey);
                  return {
                    ...msg,
                    content: msg.content, // Keep original encrypted content
                    decryptedContent: decryptedContent,
                    error: error,
                  } as NostrEvent & { decryptedContent?: string; error?: string };
                }
              } else if (msg.kind === 1059) {
                // NIP-17 Gift Wrap message - decrypt it
                const { processedMessage, error } = await processNIP17GiftWrap(msg);
                return {
                  ...msg, // Keep original Gift Wrap event structure
                  decryptedContent: processedMessage.decryptedContent, // Store decrypted content
                  error: error,
                } as NostrEvent & { decryptedContent?: string; error?: string };
              }

              // For non-encrypted messages, just return as-is
              return msg;
            }));

            newState.set(participantPubkey, {
              messages: processedMessages,
              lastActivity: participant.lastActivity,
              lastMessage: processedMessages.length > 0 ? processedMessages[processedMessages.length - 1] : null, // Last after sorting (newest)
              hasNIP4: participant.hasNIP4,
              hasNIP17: participant.hasNIP17,
            });
          }

          // Update state with cached messages
          setMessages(newState);
          logger.log(`DMS: DataManager: ✅ Loaded ${totalMessages} cached messages for ${newState.size} participants into state`);

          // Also update lastSync from the cached data
          if (cachedStore.lastSync) {
            setLastSync(cachedStore.lastSync);
            logger.log(`DMS: DataManager: Updated lastSync from cached data: NIP-4: ${cachedStore.lastSync.nip4 ? new Date(cachedStore.lastSync.nip4 * 1000).toISOString() : 'Never'}, NIP-17: ${cachedStore.lastSync.nip17 ? new Date(cachedStore.lastSync.nip17 * 1000).toISOString() : 'Never'}`);
          }
        } else {
          logger.log(`DMS: DataManager: No cached messages found in IndexedDB (${dbReadTime}ms)`);
        }
      } catch (error) {
        logger.error('DMS: DataManager: Error reading from IndexedDB:', error);
      }

      // Log total time for Stage 1
      const totalTime = Date.now() - startTime;
      logger.log(`DMS: DataManager: [${protocol.toUpperCase()}] Stage 1 complete in ${totalTime}ms`);

      return sinceTimestamp;
    } catch (error) {
      logger.error(`DMS: DataManager: Error in Stage 1 for ${protocol}:`, error);
      return undefined;
    }
  }, [settings.enableNIP17, userPubkey]);

  // Stage 2: Query for messages between last sync and now for a specific protocol
  const queryRelaysForMessagesSince = useCallback(async (protocol: MessageProtocol, sinceTimestamp?: number): Promise<MessageProcessingResult> => {
    logger.log(`DMS: DataManager: [${protocol.toUpperCase()}] Stage 2 - Querying for missed messages since ${sinceTimestamp ? new Date(sinceTimestamp * 1000).toISOString() : 'beginning'}`);

    // Skip NIP-17 if it's disabled
    if (protocol === MESSAGE_PROTOCOL.NIP17 && !settings.enableNIP17) {
      logger.log('DMS: DataManager: NIP-17 disabled, skipping relay querying');
      return { lastMessageTimestamp: sinceTimestamp, messageCount: 0 };
    }

    // Ensure we have a user pubkey
    if (!userPubkey) {
      logger.log('DMS: DataManager: No user pubkey available, skipping relay querying');
      return { lastMessageTimestamp: sinceTimestamp, messageCount: 0 };
    }

    if (protocol === MESSAGE_PROTOCOL.NIP04) {
      const relayStartTime = Date.now();
      const messages = await loadPastNIP4Messages(sinceTimestamp);
      const relayTime = Date.now() - relayStartTime;
      logger.log(`DMS: DataManager: NIP-4 Stage 2 complete: ${messages?.length || 0} messages loaded from relays (${relayTime}ms)`);

      // Store NIP-4 messages organized by participant
      if (messages && messages.length > 0) {
        // Build up new state
        const newState = new Map();

        // Process messages and decrypt them
        for (const message of messages) {
          const isFromUser = message.pubkey === user?.pubkey;
          const recipientPTag = message.tags?.find(([name]) => name === 'p')?.[1];
          const otherPubkey = isFromUser ? recipientPTag : message.pubkey;

          if (!otherPubkey || otherPubkey === user?.pubkey) continue;

          // Decrypt the NIP-4 message content using reusable method
          const { decryptedContent, error } = await decryptNIP4Message(message, otherPubkey);

          // Create decrypted message
          const decryptedMessage: DecryptedMessage = {
            ...message,
            content: message.content, // Keep original encrypted content
            decryptedContent: decryptedContent, // Store decrypted content
            error: error, // Add error field
          };

          // Add clientFirstSeen for genuinely recent messages (created in last 5 seconds)
          const messageAge = Date.now() - (message.created_at * 1000);
          if (messageAge < 5000) { // 5 seconds
            decryptedMessage.clientFirstSeen = Date.now();
          }

          // Add to new state or create new participant
          if (!newState.has(otherPubkey)) {
            newState.set(otherPubkey, createEmptyParticipant());
          }

          const participant = newState.get(otherPubkey)!;
          participant.messages.push(decryptedMessage);
          participant.hasNIP4 = true;
        }

        // Sort all participants' messages once after adding all messages
        newState.forEach(participant => {
          sortAndUpdateParticipantState(participant);
        });

        // Update state with new data - preserve existing protocol flags
        mergeMessagesIntoState(newState);

        // Update lastSync for NIP-4 to the current time since we just processed new messages
        const currentTime = Math.floor(Date.now() / 1000);
        setLastSync(prev => ({ ...prev, nip4: currentTime }));
        logger.log(`DMS: DataManager: Updated lastSync.nip4 to ${new Date(currentTime * 1000).toISOString()}`);

        logger.log(`DMS: DataManager: Stored ${messages.length} decrypted NIP-4 messages for ${newState.size} participants`);

        // Return the timestamp of the newest message processed
        const newestMessage = messages.reduce((newest, msg) =>
          msg.created_at > newest.created_at ? msg : newest
        );
        return { lastMessageTimestamp: newestMessage.created_at, messageCount: messages.length };
      } else {
        return { lastMessageTimestamp: sinceTimestamp, messageCount: 0 };
      }
    } else if (protocol === MESSAGE_PROTOCOL.NIP17) {
      const relayStartTime = Date.now();
      const messages = await loadPastNIP17Messages(sinceTimestamp);
      const relayTime = Date.now() - relayStartTime;
      logger.log(`DMS: DataManager: NIP-17 Stage 2 complete: ${messages?.length || 0} messages loaded from relays (${relayTime}ms)`);

      // Store NIP-17 messages organized by participant
      if (messages && messages.length > 0) {
        // Build up new state
        const newState = new Map();

        // Process messages and decrypt them
        for (const giftWrap of messages) {
          // Process the Gift Wrap message using reusable method
          const { processedMessage, conversationPartner } = await processNIP17GiftWrap(giftWrap);

          // Store the original Gift Wrap event with decrypted content for display
          const messageWithAnimation: DecryptedMessage = {
            ...giftWrap, // Keep original Gift Wrap event structure
            decryptedContent: processedMessage.decryptedContent, // Store decrypted content
            error: processedMessage.error, // Store any decryption errors
          };

          const messageAge = Date.now() - (giftWrap.created_at * 1000);
          if (messageAge < 5000) { // 5 seconds
            messageWithAnimation.clientFirstSeen = Date.now();
          }

          // Add message to state
          if (!newState.has(conversationPartner)) {
            newState.set(conversationPartner, createEmptyParticipant());
          }

          newState.get(conversationPartner)!.messages.push(messageWithAnimation);
          newState.get(conversationPartner)!.hasNIP17 = true;
        }

        // Sort all participants' messages once after adding all messages
        newState.forEach(participant => {
          sortAndUpdateParticipantState(participant);
        });

        // Update state with new data - preserve existing protocol flags
        mergeMessagesIntoState(newState);

        // Update lastSync for NIP-17 to the current time since we just processed new messages
        const currentTime = Math.floor(Date.now() / 1000);
        setLastSync(prev => ({ ...prev, nip17: currentTime }));
        logger.log(`DMS: DataManager: Updated lastSync.nip17 to ${new Date(currentTime * 1000).toISOString()}`);

        logger.log(`DMS: DataManager: Stored ${messages.length} decrypted NIP-17 messages for ${newState.size} participants`);

        // Return the timestamp of the newest message processed
        const newestMessage = messages.reduce((newest, msg) =>
          msg.created_at > newest.created_at ? msg : newest
        );
        return { lastMessageTimestamp: newestMessage.created_at, messageCount: messages.length };
      } else {
        return { lastMessageTimestamp: sinceTimestamp, messageCount: 0 };
      }
    }

    // If no messages were processed, return the input timestamp
    return { lastMessageTimestamp: sinceTimestamp, messageCount: 0 };
  }, [settings.enableNIP17, userPubkey, loadPastNIP4Messages, loadPastNIP17Messages]);

  // Reusable method to decrypt NIP-4 message content
  const decryptNIP4Message = useCallback(async (event: NostrEvent, otherPubkey: string): Promise<DecryptionResult> => {
    try {
      if (user?.signer?.nip04) {
        const decryptedContent = await user.signer.nip04.decrypt(otherPubkey, event.content);
        return { decryptedContent };
      } else {
        logger.log(`DMS: DataManager: No NIP-04 decryption available for message ${event.id}`);
        return {
          decryptedContent: '',
          error: 'No NIP-04 decryption available'
        };
      }
    } catch (error) {
      logger.error(`DMS: DataManager: Failed to decrypt NIP-4 message ${event.id}:`, error);
      return {
        decryptedContent: '',
        error: 'Decryption failed'
      };
    }
  }, [user]);

  // Helper to create an empty participant with default values
  const createEmptyParticipant = useCallback(() => ({
    messages: [],
    lastActivity: 0,
    lastMessage: null,
    hasNIP4: false,
    hasNIP17: false,
  }), []);

  // Helper to sort messages and update participant state
  const sortAndUpdateParticipantState = useCallback((participant: { messages: DecryptedMessage[]; lastActivity: number; lastMessage: DecryptedMessage | null }) => {
    participant.messages.sort((a, b) => a.created_at - b.created_at); // Oldest first
    if (participant.messages.length > 0) {
      participant.lastActivity = participant.messages[participant.messages.length - 1].created_at; // Last after sorting (newest)
      participant.lastMessage = participant.messages[participant.messages.length - 1];
    }
  }, []);

  // Helper to merge new messages into existing state
  const mergeMessagesIntoState = useCallback((newState: MessagesState) => {
    setMessages(prev => {
      const finalMap = new Map(prev);

      // Merge with new data
      newState.forEach((value, key) => {
        const existing = finalMap.get(key);
        if (existing) {
          // Merge with existing participant, preserving protocol flags and deduplicating messages
          const existingMessageIds = new Set(existing.messages.map(msg => msg.id));
          const newMessages = value.messages.filter(msg => !existingMessageIds.has(msg.id));

          if (newMessages.length > 0) {
            logger.log(`DMS: DataManager: Merging ${newMessages.length} new messages for ${key} (${value.messages.length - newMessages.length} duplicates filtered out)`);
          }

          const mergedMessages = [...existing.messages, ...newMessages];
          mergedMessages.sort((a, b) => a.created_at - b.created_at); // Keep oldest first

          finalMap.set(key, {
            ...existing,
            messages: mergedMessages,
            hasNIP4: existing.hasNIP4 || value.hasNIP4,
            hasNIP17: existing.hasNIP17 || value.hasNIP17,
          });
        } else {
          finalMap.set(key, value);
        }
      });

      return finalMap;
    });
  }, []);

  // Debounced write ref for IndexedDB persistence
  const debouncedWriteRef = useRef<NodeJS.Timeout | null>(null);

  // Reusable method to add a message to the state
  const addMessageToState = useCallback((message: DecryptedMessage, conversationPartner: string, protocol: MessageProtocol) => {
    setMessages(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(conversationPartner);

      if (existing) {
        // Check if message already exists to prevent duplicates
        if (existing.messages.some(msg => msg.id === message.id)) {
          logger.log(`DMS: DataManager: ${protocol} message ${message.id} already exists in conversation, skipping`);
          return prev; // Return unchanged state
        }

        // Check if this real message should replace an optimistic message
        const optimisticIndex = existing.messages.findIndex(msg =>
          msg.isSending &&
          msg.pubkey === message.pubkey &&
          msg.decryptedContent === message.decryptedContent && // Both have decryptedContent
          Math.abs(msg.created_at - message.created_at) <= 30 // 30 second window
        );

        let updatedMessages: DecryptedMessage[];
        if (optimisticIndex !== -1) {
          // Replace the optimistic message with the real one (preserve animation timestamp)
          logger.log(`DMS: DataManager: Replacing optimistic message at index ${optimisticIndex} with real message ${message.id}`);
          const existingMessage = existing.messages[optimisticIndex];
          updatedMessages = [...existing.messages];
          updatedMessages[optimisticIndex] = {
            ...message,
            created_at: existingMessage.created_at, // Preserve optimistic timestamp to maintain position
            clientFirstSeen: existingMessage.clientFirstSeen // Preserve animation timestamp
          };
        } else {
          // Add as new message
          updatedMessages = [...existing.messages, message];
        }

        updatedMessages.sort((a, b) => a.created_at - b.created_at); // Keep oldest first

        newMap.set(conversationPartner, {
          ...existing,
          messages: updatedMessages,
          lastActivity: message.created_at,
          lastMessage: message,
          hasNIP4: protocol === MESSAGE_PROTOCOL.NIP04 ? true : existing.hasNIP4,
          hasNIP17: protocol === MESSAGE_PROTOCOL.NIP17 ? true : existing.hasNIP17,
        });

        logger.log(`DMS: DataManager: Updated existing conversation with ${conversationPartner}, now has ${updatedMessages.length} messages`);
      } else {
        // Create new conversation
        const newConversation = {
          messages: [message],
          lastActivity: message.created_at,
          lastMessage: message,
          hasNIP4: protocol === MESSAGE_PROTOCOL.NIP04,
          hasNIP17: protocol === MESSAGE_PROTOCOL.NIP17,
        };

        newMap.set(conversationPartner, newConversation);
        logger.log(`DMS: DataManager: Created new conversation with ${conversationPartner}`);
      }

      logger.log(`DMS: DataManager: State update complete. Total conversations: ${newMap.size}`);

      return newMap;
    });
  }, []);

  // Process incoming NIP-4 messages and add them to the data structure
  const processIncomingNIP4Message = useCallback(async (event: NostrEvent) => {
    if (!user?.pubkey) return;

    logger.log(`DMS: DataManager: Processing incoming NIP-4 message: ${event.id}`);

    // Validate the DM event
    if (!validateDMEvent(event)) {
      logger.warn(`DMS: DataManager: Invalid NIP-4 event received: ${event.id}`);
      return;
    }

    // Determine conversation partner
    const isFromUser = event.pubkey === user.pubkey;
    const recipientPTag = event.tags?.find(([name]) => name === 'p')?.[1];
    const otherPubkey = isFromUser ? recipientPTag : event.pubkey;

    if (!otherPubkey || otherPubkey === user.pubkey) {
      logger.warn(`DMS: DataManager: Invalid conversation partner in NIP-4 event: ${event.id}`);
      return;
    }

    // Decrypt the message content
    const { decryptedContent, error } = await decryptNIP4Message(event, otherPubkey);

    // Create decrypted message with clientFirstSeen for animation
    const decryptedMessage: DecryptedMessage = {
      ...event,
      content: event.content, // Keep original encrypted content
      decryptedContent: decryptedContent, // Store decrypted content
      error: error, // Add error field
    };

    // Add clientFirstSeen for genuinely recent messages (created in last 5 seconds)
    const messageAge = Date.now() - (event.created_at * 1000);
    if (messageAge < 5000) { // 5 seconds
      decryptedMessage.clientFirstSeen = Date.now();
    }

    // Add to messages state using reusable method
    addMessageToState(decryptedMessage, otherPubkey, MESSAGE_PROTOCOL.NIP04);

    logger.log(`DMS: DataManager: Added incoming NIP-4 message to conversation with ${otherPubkey}`);
  }, [user, decryptNIP4Message, addMessageToState]);

  // Reusable method to process NIP-17 Gift Wrap messages
  const processNIP17GiftWrap = useCallback(async (event: NostrEvent): Promise<NIP17ProcessingResult> => {
    if (!user?.signer?.nip44) {
      // No decryption available - store with error
      return {
        processedMessage: {
          ...event,
          content: '', // Keep original encrypted content
          decryptedContent: '', // No decrypted content
          error: 'No NIP-44 decryption available',
        },
        conversationPartner: event.pubkey,
      };
    }

    try {
      // Decrypt Gift Wrap → Seal → Private DM
      const sealContent = await user.signer.nip44.decrypt(event.pubkey, event.content);
      const sealEvent = JSON.parse(sealContent) as NostrEvent;

      if (sealEvent.kind !== 13) {
        // Invalid Seal format - store with error
        return {
          processedMessage: {
            ...event,
            content: '', // Keep original encrypted content
            decryptedContent: '', // No decrypted content
            error: `Invalid Seal format - expected kind 13, got ${sealEvent.kind}`,
          },
          conversationPartner: event.pubkey,
        };
      }

      const messageContent = await user.signer.nip44.decrypt(sealEvent.pubkey, sealEvent.content);
      const messageEvent = JSON.parse(messageContent) as NostrEvent;

      if (messageEvent.kind !== 14) {
        // Invalid message format - store with error
        return {
          processedMessage: {
            ...event,
            content: '', // Keep original encrypted content
            decryptedContent: '', // No decrypted content
            error: `Invalid message format - expected kind 14, got ${messageEvent.kind}`,
          },
          conversationPartner: event.pubkey,
        };
      }

      // Determine conversation partner
      let conversationPartner: string;
      if (sealEvent.pubkey === user.pubkey) {
        const recipient = messageEvent.tags.find(([name]) => name === 'p')?.[1];
        if (!recipient || recipient === user.pubkey) {
          // Invalid recipient - store with error
          return {
            processedMessage: {
              ...event,
              content: '', // Keep original encrypted content
              decryptedContent: '', // No decrypted content
              error: 'Invalid recipient - malformed p tag',
            },
            conversationPartner: event.pubkey,
          };
        } else {
          conversationPartner = recipient;
        }
      } else {
        conversationPartner = sealEvent.pubkey;
      }

      return {
        processedMessage: {
          ...messageEvent,
          content: event.content, // Keep original encrypted content
          decryptedContent: messageEvent.content, // Store decrypted content
        },
        conversationPartner,
      };
    } catch (error) {
      // Decryption/parsing failed - store with error
      nip17ErrorLogger(error);
      return {
        processedMessage: {
          ...event,
          content: '', // Keep original encrypted content
          decryptedContent: '', // No decrypted content
          error: 'Failed to decrypt or parse NIP-17 message',
        },
        conversationPartner: event.pubkey,
      };
    }
  }, [user]);

  // Reusable method to process NIP-17 Gift Wrap messages
  const processIncomingNIP17Message = useCallback(async (event: NostrEvent) => {
    if (!user?.pubkey) return;

    logger.log(`DMS: DataManager: Processing incoming NIP-17 message: ${event.id}`);

    // NIP-17 messages are kind 1059 (Gift Wrap)
    if (event.kind !== 1059) {
      logger.warn(`DMS: DataManager: Invalid NIP-17 event kind: ${event.kind} for event ${event.id}`);
      return;
    }

    // Process the Gift Wrap message using reusable method
    const { processedMessage, conversationPartner } = await processNIP17GiftWrap(event);

    // Store the original Gift Wrap event with decrypted content for display
    const messageWithAnimation: DecryptedMessage = {
      ...event, // Keep original Gift Wrap event structure
      decryptedContent: processedMessage.decryptedContent, // Store decrypted content
      error: processedMessage.error, // Store any decryption errors
    };

    // Add clientFirstSeen for genuinely recent messages (created in last 5 seconds)
    const messageAge = Date.now() - (event.created_at * 1000);
    if (messageAge < 5000) { // 5 seconds
      messageWithAnimation.clientFirstSeen = Date.now();
    }

    // Add to messages state using reusable method
    addMessageToState(messageWithAnimation, conversationPartner, MESSAGE_PROTOCOL.NIP17);

    logger.log(`DMS: DataManager: Added incoming NIP-17 message to conversation with ${conversationPartner}`);
  }, [user, processNIP17GiftWrap, addMessageToState]);

  // Start NIP-4 subscription for all conversations
  const startNIP4Subscription = useCallback(async (sinceTimestamp?: number) => {
    if (!user?.pubkey || !nostr) return;

    // Close existing subscription
    if (nip4SubscriptionRef.current) {
      nip4SubscriptionRef.current.close();
      logger.log('DMS: DataManager: Closed existing NIP-4 subscription');
    }

    try {
      // Use provided timestamp or fall back to lastSync
      let subscriptionSince = sinceTimestamp || Math.floor(Date.now() / 1000);
      if (!sinceTimestamp && lastSync.nip4) {
        // Subtract 60 seconds to ensure we don't miss messages due to optimistic updates
        subscriptionSince = lastSync.nip4 - 60;
      }

      const filters = [
        {
          kinds: [4], // NIP-4 DMs sent to us
          '#p': [user.pubkey],
          since: subscriptionSince,
        },
        {
          kinds: [4], // NIP-4 DMs sent by us
          authors: [user.pubkey],
          since: subscriptionSince,
        }
      ];

      logger.log(`DMS: DataManager: Starting NIP-4 subscription since ${new Date(subscriptionSince * 1000).toISOString()}`);
      logger.log(`DMS: DataManager: NIP-4 subscription filters:`, JSON.stringify(filters, null, 2));
      logger.log(`DMS: DataManager: User pubkey: ${user.pubkey}`);

      const subscription = nostr.req(filters);
      let isActive = true;

      // Process messages
      (async () => {
        try {
          for await (const msg of subscription) {
            if (!isActive) break;
            if (msg[0] === 'EVENT') {
              logger.log(`DMS: DataManager: Received NIP-4 event: ${msg[2].id} from ${msg[2].pubkey}`);
              await processIncomingNIP4Message(msg[2]);
            } else {
              logger.log(`DMS: DataManager: Received non-event message:`, msg);
            }
          }
        } catch (error) {
          if (isActive) {
            logger.error('DMS: DataManager: NIP-4 subscription error:', error);
          }
        }
      })();

      nip4SubscriptionRef.current = {
        close: () => {
          isActive = false;
          logger.log('DMS: DataManager: NIP-4 subscription closed');
        }
      };

      // Update subscription status
      setSubscriptions(prev => ({ ...prev, nip4: true }));
      logger.log('DMS: DataManager: NIP-4 subscription started successfully');
      logger.log('DMS: DataManager: NIP-4 subscription ref:', !!nip4SubscriptionRef.current);

    } catch (error) {
      logger.error('DMS: DataManager: Failed to start NIP-4 subscription:', error);
      setSubscriptions(prev => ({ ...prev, nip4: false }));
    }
  }, [user, nostr, lastSync.nip4, processIncomingNIP4Message]);

  // Start NIP-17 subscription for all conversations
  const startNIP17Subscription = useCallback(async (sinceTimestamp?: number) => {
    if (!user?.pubkey || !nostr || !settings.enableNIP17) return;

    // Close existing subscription
    if (nip17SubscriptionRef.current) {
      nip17SubscriptionRef.current.close();
      logger.log('DMS: DataManager: Closed existing NIP-17 subscription');
    }

    try {
      // Use provided timestamp or fall back to lastSync
      let subscriptionSince = sinceTimestamp || Math.floor(Date.now() / 1000);
      if (!sinceTimestamp && lastSync.nip17) {
        // Subtract 60 seconds to ensure we don't miss messages due to optimistic updates
        subscriptionSince = lastSync.nip17 - 60;
      }

      const filters = [{
        kinds: [1059], // NIP-17 Gift Wrap messages
        '#p': [user.pubkey], // We are the recipient
        since: subscriptionSince,
      }];

      logger.log(`DMS: DataManager: Starting NIP-17 subscription since ${new Date(subscriptionSince * 1000).toISOString()}`);
      logger.log(`DMS: DataManager: NIP-17 subscription filters:`, JSON.stringify(filters, null, 2));
      logger.log(`DMS: DataManager: User pubkey: ${user.pubkey}`);

      const subscription = nostr.req(filters);
      let isActive = true;

      // Process messages
      (async () => {
        try {
          for await (const msg of subscription) {
            if (!isActive) break;
            if (msg[0] === 'EVENT') {
              logger.log(`DMS: DataManager: Received NIP-17 event: ${msg[2].id} from ${msg[2].pubkey}`);
              await processIncomingNIP17Message(msg[2]);
            } else {
              logger.log(`DMS: DataManager: Received non-event message:`, msg);
            }
          }
        } catch (error) {
          if (isActive) {
            logger.error('DMS: DataManager: NIP-17 subscription error:', error);
          }
        }
      })();

      nip17SubscriptionRef.current = {
        close: () => {
          isActive = false;
          logger.log('DMS: DataManager: NIP-17 subscription closed');
        }
      };

      // Update subscription status
      setSubscriptions(prev => ({ ...prev, nip17: true }));
      logger.log('DMS: DataManager: NIP-17 subscription started successfully');
      logger.log('DMS: DataManager: NIP-17 subscription ref:', !!nip17SubscriptionRef.current);

    } catch (error) {
      logger.error('DMS: DataManager: Failed to start NIP-17 subscription:', error);
      setSubscriptions(prev => ({ ...prev, nip17: false }));
    }
  }, [user, nostr, lastSync.nip17, settings.enableNIP17, processIncomingNIP17Message]);





  // Helper function to add a message to a community channel (more succinct than nested state updates)
  const addMessageToChannel = useCallback((communityId: string, channelId: string, message: NostrEvent, isOptimistic = false) => {
    setCommunities(prev => {
      const community = prev.get(communityId);
      if (!community) return prev;

      const channel = community.channels.get(channelId);
      if (!channel) return prev;

      // Check if message already exists (for real messages)
      if (!isOptimistic && channel.messages.some(msg => msg.id === message.id)) {
        logger.log(`Communities: Message ${message.id} already exists in channel ${channelId}, skipping`);
        return prev;
      }

      // Check for optimistic replacement (for real messages)
      let updatedMessages: NostrEvent[];
      if (!isOptimistic) {
        const optimisticIndex = channel.messages.findIndex(msg =>
          msg.isSending &&
          msg.pubkey === message.pubkey &&
          msg.content === message.content &&
          Math.abs(msg.created_at - message.created_at) <= 30 // 30 second window
        );

        if (optimisticIndex !== -1) {
          // Replace optimistic with real message (preserve animation timestamp)
          logger.log(`Communities: Replacing optimistic message at index ${optimisticIndex} with real message ${message.id}`);
          const existingMessage = channel.messages[optimisticIndex];
          updatedMessages = [...channel.messages];
          updatedMessages[optimisticIndex] = {
            ...message,
            created_at: existingMessage.created_at, // Preserve optimistic timestamp
            clientFirstSeen: existingMessage.clientFirstSeen // Preserve animation timestamp
          };
        } else {
          // Add new message and sort by timestamp (oldest first)
          updatedMessages = [...channel.messages, message].sort((a, b) => a.created_at - b.created_at);
        }
      } else {
        // Add optimistic message and sort by timestamp (oldest first)
        updatedMessages = [...channel.messages, message].sort((a, b) => a.created_at - b.created_at);
      }

      // Create updated structures efficiently
      const updatedChannel = { ...channel, messages: updatedMessages, lastActivity: Math.max(channel.lastActivity, message.created_at) };
      const updatedChannels = new Map(community.channels);
      updatedChannels.set(channelId, updatedChannel);
      const updatedCommunity = { ...community, channels: updatedChannels, lastActivity: Math.max(community.lastActivity, message.created_at) };
      const newCommunities = new Map(prev);
      newCommunities.set(communityId, updatedCommunity);

      logger.log(`Communities: Added ${isOptimistic ? 'optimistic ' : ''}message ${message.id} to channel ${channelId} in community ${communityId}`);
      return newCommunities;
    });
  }, []);

  // Process incoming community messages and route them to the correct channel
  const processIncomingCommunityMessage = useCallback(async (event: NostrEvent, communitiesToUse?: Map<string, CommunityData>) => {
    if (!user?.pubkey) return;

    logger.log(`Communities: Processing incoming message: ${event.id} (kind: ${event.kind})`);

    // Validate message kinds
    if (![9411, 1111, 32807, 5].includes(event.kind)) {
      logger.warn(`Communities: Invalid message kind: ${event.kind} for event ${event.id}`);
      return;
    }

    // Get community reference from 'a' tag
    const communityRef = event.tags.find(([name]) => name === 'a')?.[1];
    if (!communityRef) {
      logger.warn(`Communities: No community reference found in event ${event.id}`);
      return;
    }

    // Extract simple community ID from 'a' tag
    // Expected formats by event kind:
    // - 9411, 1111, 7, 9735, 5: FULL addressable "34550:pubkey:identifier" 
    // - 32807: SIMPLE "identifier" (inconsistent - TODO: fix at creation point)
    // Handle both for defensive compatibility with other clients
    const simpleCommunityId = (() => {
      if (communityRef.includes(':')) {
        const parts = communityRef.split(':');
        if (parts.length === 3) {
          return parts[2]; // Full addressable format (expected for messages)
        }
        return parts[parts.length - 1]; // Fallback for weird formats
      }
      return communityRef; // Simple format (expected for channels)
    })();

    // Find the community in our state
    const communitiesForProcessing = communitiesToUse || communities;
    const community = communitiesForProcessing.get(simpleCommunityId);
    if (!community) {
      logger.log(`Communities: Community ${simpleCommunityId} not found in state, ignoring message ${event.id}`);
      return;
    }

    if (event.kind === 9411) {
      // Channel message - get channel slug from 't' tag
      // Format: "34550:pubkey:communitySlug:channelSlug" - we need the last part
      const tTag = event.tags.find(([name]) => name === 't')?.[1];
      if (!tTag) {
        logger.warn(`Communities: No 't' tag found in channel message ${event.id}`);
        return;
      }
      
      // Extract just the channel slug (last part after splitting by colons)
      const channelId = tTag.includes(':') ? tTag.split(':').pop()! : tTag;

      // Find the channel in the community
      const channel = community.channels.get(channelId);
      if (!channel) {
        logger.log(`Communities: Channel ${channelId} not found in community ${simpleCommunityId}, creating placeholder channel for message ${event.id}`);

        // Create a placeholder channel for this message
        // This handles the race condition where a message arrives before the channel creation event
        const placeholderChannel: ChannelData = {
          id: channelId,
          communityId: simpleCommunityId,
          info: {
            name: channelId, // Use channel ID as name initially
            description: undefined,
            type: 'text', // Default to text
            folderId: undefined,
            position: 999, // Put at end until we get the real channel definition
          },
          definition: {} as NostrEvent, // Placeholder - will be replaced when real channel definition arrives
          messages: [],
          replies: new Map(),
          reactions: new Map(),
          pinnedMessages: [],
          permissions: null,
          lastActivity: event.created_at,
          // Initialize pagination state
          hasMoreMessages: true,
          isLoadingOlderMessages: false,
          reachedStartOfConversation: false,
        };

        // Add placeholder channel to community
        setCommunities(prev => {
          const newCommunities = new Map(prev);
          const updatedCommunity = { ...newCommunities.get(simpleCommunityId)! };
          const updatedChannels = new Map(updatedCommunity.channels);
          updatedChannels.set(channelId, placeholderChannel);
          updatedCommunity.channels = updatedChannels;
          newCommunities.set(simpleCommunityId, updatedCommunity);

          logger.log(`Communities: Created placeholder channel ${channelId} in community ${simpleCommunityId}`);
          return newCommunities;
        });
      }

      // Use helper function to add message (much more concise!)
      addMessageToChannel(simpleCommunityId, channelId, event);

    } else if (event.kind === 1111) {
      // Reply message - get the message ID it's replying to from 'e' tag
      const replyToMessageId = event.tags.find(([name]) => name === 'e')?.[1];
      if (!replyToMessageId) {
        logger.warn(`Communities: No reply target found in reply ${event.id}`);
        return;
      }

      // Find which channel contains the message being replied to
      let targetChannelId: string | null = null;
      for (const [channelId, channel] of community.channels) {
        if (channel.messages.some(msg => msg.id === replyToMessageId)) {
          targetChannelId = channelId;
          break;
        }
      }

      if (!targetChannelId) {
        logger.log(`Communities: Target message ${replyToMessageId} not found in any channel, ignoring reply ${event.id}`);
        return;
      }

      // Add reply to the channel
      setCommunities(prev => {
        const newCommunities = new Map(prev);
        const updatedCommunity = { ...newCommunities.get(simpleCommunityId)! };
        const updatedChannels = new Map(updatedCommunity.channels);
        const updatedChannel = { ...updatedChannels.get(targetChannelId)! };

        // Check if reply already exists
        const existingReplies = updatedChannel.replies.get(replyToMessageId) || [];
        if (existingReplies.some(reply => reply.id === event.id)) {
          logger.log(`Communities: Reply ${event.id} already exists for message ${replyToMessageId}, skipping`);
          return prev;
        }

        // Add reply and sort by timestamp
        const updatedReplies = [...existingReplies, event].sort((a, b) => a.created_at - b.created_at);
        const newRepliesMap = new Map(updatedChannel.replies);
        newRepliesMap.set(replyToMessageId, updatedReplies);

        updatedChannel.replies = newRepliesMap;
        updatedChannel.lastActivity = Math.max(updatedChannel.lastActivity, event.created_at);
        updatedChannels.set(targetChannelId, updatedChannel);
        updatedCommunity.channels = updatedChannels;
        updatedCommunity.lastActivity = Math.max(updatedCommunity.lastActivity, event.created_at);
        newCommunities.set(simpleCommunityId, updatedCommunity);

        logger.log(`Communities: Added reply ${event.id} to message ${replyToMessageId} in channel ${targetChannelId}`);
        return newCommunities;
      });

    } else if (event.kind === 7 || event.kind === 9735) {
      // Reaction or Zap - get the message ID it's reacting to from 'e' tag
      const reactToMessageId = event.tags.find(([name]) => name === 'e')?.[1];
      if (!reactToMessageId) {
        logger.warn(`Communities: No reaction target found in ${event.kind === 7 ? 'reaction' : 'zap'} ${event.id}`);
        return;
      }

      // Find which channel contains the message being reacted to
      let targetChannelId: string | null = null;
      for (const [channelId, channel] of community.channels) {
        if (channel.messages.some(msg => msg.id === reactToMessageId)) {
          targetChannelId = channelId;
          break;
        }
      }

      if (!targetChannelId) {
        logger.log(`Communities: Target message ${reactToMessageId} not found in any channel, ignoring ${event.kind === 7 ? 'reaction' : 'zap'} ${event.id}`);
        return;
      }

      // Add reaction to the channel
      setCommunities(prev => {
        const newCommunities = new Map(prev);
        const updatedCommunity = { ...newCommunities.get(simpleCommunityId)! };
        const updatedChannels = new Map(updatedCommunity.channels);
        const updatedChannel = { ...updatedChannels.get(targetChannelId)! };

        // Check if reaction already exists
        const existingReactions = updatedChannel.reactions.get(reactToMessageId) || [];
        if (existingReactions.some(reaction => reaction.id === event.id)) {
          logger.log(`Communities: ${event.kind === 7 ? 'Reaction' : 'Zap'} ${event.id} already exists for message ${reactToMessageId}, skipping`);
          return prev;
        }

        // Add reaction and sort by timestamp
        const updatedReactions = [...existingReactions, event].sort((a, b) => a.created_at - b.created_at);
        const newReactionsMap = new Map(updatedChannel.reactions);
        newReactionsMap.set(reactToMessageId, updatedReactions);

        updatedChannel.reactions = newReactionsMap;
        updatedChannel.lastActivity = Math.max(updatedChannel.lastActivity, event.created_at);
        updatedChannels.set(targetChannelId, updatedChannel);
        updatedCommunity.channels = updatedChannels;
        updatedCommunity.lastActivity = Math.max(updatedCommunity.lastActivity, event.created_at);
        newCommunities.set(simpleCommunityId, updatedCommunity);

        logger.log(`Communities: Added ${event.kind === 7 ? 'reaction' : 'zap'} ${event.id} to message ${reactToMessageId} in channel ${targetChannelId}`);
        return newCommunities;
      });

    } else if (event.kind === 32807) {
      // New channel creation event
      const dTag = event.tags.find(([name]) => name === 'd')?.[1];
      const aTag = event.tags.find(([name]) => name === 'a')?.[1];

      if (!dTag) {
        logger.warn(`Communities: No d tag found in channel creation event ${event.id}`);
        return;
      }

      // Extract channel name from d tag
      // CreateChannelDialog creates: "universes:channelName" (composite format)
      // But we store channels using just the channel name for simplicity
      // TODO: Decide if we should use composite IDs or simple names consistently
      const channelId = dTag.includes(':') ? dTag.split(':').pop()! : dTag;

      logger.log(`Communities: Received channel creation event ${event.id} for channel "${channelId}" (d tag: "${dTag}") in community "${aTag}"`);

      // Check if channel already exists
      const existingChannel = community.channels.get(channelId);
      if (existingChannel && existingChannel.definition.id && !existingChannel.definition.isSending) {
        // Real channel definition already exists, ignore duplicate
        logger.log(`Communities: Channel ${channelId} already exists in community ${simpleCommunityId}, ignoring duplicate`);
        return;
      }

      // Parse channel info from the event
      const channelName = event.tags.find(([name]) => name === 'name')?.[1] || channelId;
      const channelDescription = event.tags.find(([name]) => name === 'description')?.[1] ||
        event.tags.find(([name]) => name === 'about')?.[1];
      const channelType = event.tags.find(([name]) => name === 'channel_type')?.[1] as 'text' | 'voice' || 'text';
      const folderId = event.tags.find(([name]) => name === 'folder')?.[1];
      const position = parseInt(event.tags.find(([name]) => name === 'position')?.[1] || '0');

      // Try to parse content for additional metadata
      let contentData: ChannelInfo = { name: '', type: 'text' };
      try {
        contentData = JSON.parse(event.content) as ChannelInfo;
      } catch {
        // Ignore parsing errors
      }

      // Create new channel data
      const newChannelData: ChannelData = {
        id: channelId,
        communityId: simpleCommunityId,
        info: {
          name: contentData?.name || channelName,
          description: contentData?.description || channelDescription,
          type: contentData?.type || channelType,
          folderId: contentData?.folderId || folderId,
          position: contentData?.position ?? position ?? 0,
        },
        definition: event,
        messages: [], // Start with empty messages
        replies: new Map(), // Start with empty replies
        reactions: new Map(), // Start with empty reactions
        pinnedMessages: [], // Start with empty pinned messages
        permissions: null, // Will be loaded separately if needed
        lastActivity: event.created_at,
        // Initialize pagination state
        hasMoreMessages: true,
        isLoadingOlderMessages: false,
        reachedStartOfConversation: false,
      };

      // If this was a placeholder or optimistic channel, preserve any messages it had
      if (existingChannel && (!existingChannel.definition.id || existingChannel.definition.isSending)) {
        const channelType = existingChannel.definition.isSending ? 'optimistic' : 'placeholder';
        logger.log(`Communities: Replacing ${channelType} channel ${channelId} with real definition, preserving ${existingChannel.messages.length} messages`);
        newChannelData.messages = existingChannel.messages;
        newChannelData.replies = existingChannel.replies;
        newChannelData.lastActivity = Math.max(newChannelData.lastActivity, existingChannel.lastActivity);
      }

      // Add the new channel to the community (or replace placeholder)
      setCommunities(prev => {
        const community = prev.get(simpleCommunityId)!;
        const beforeCount = community.channels.size;
        const updatedChannels = new Map(community.channels);
        updatedChannels.set(channelId, newChannelData);
        const afterCount = updatedChannels.size;

        const updatedCommunity = {
          ...community,
          channels: updatedChannels,
          lastActivity: Math.max(community.lastActivity, event.created_at),
        };

        const newCommunities = new Map(prev);
        newCommunities.set(simpleCommunityId, updatedCommunity);

        const action = existingChannel && !existingChannel.definition.id ? 'Updated placeholder' : 'Added new';
        logger.log(`Communities: ${action} channel "${channelName}" (${channelId}) in community ${simpleCommunityId} (channels: ${beforeCount} -> ${afterCount})`);

        return newCommunities;
      });
    } else if (event.kind === 5) {
      // Deletion event - remove the referenced event
      const deletedEventId = event.tags.find(([name]) => name === 'e')?.[1];
      if (!deletedEventId) {
        logger.warn(`Communities: No event ID found in deletion event ${event.id}`);
        return;
      }

      const deletedKind = event.tags.find(([name]) => name === 'k')?.[1];

      setCommunities(prev => {
        const newCommunities = new Map(prev);
        const updatedCommunity = { ...newCommunities.get(simpleCommunityId)! };
        const updatedChannels = new Map(updatedCommunity.channels);

        switch (deletedKind) {
          case '32807': {
            // Channel definition deletion - remove entire channel
            for (const [channelId, channel] of updatedChannels) {
              if (channel.definition.id === deletedEventId) {
                updatedChannels.delete(channelId);
                logger.log(`Communities: Deleted channel ${channelId} (${channel.info.name})`);
                updatedCommunity.channels = updatedChannels;
                newCommunities.set(simpleCommunityId, updatedCommunity);
                return newCommunities;
              }
            }
            break;
          }
          default: {
            // Message deletion - find and remove message from any channel
            for (const [channelId, channel] of updatedChannels) {
              const messageIndex = channel.messages.findIndex(msg => msg.id === deletedEventId);
              if (messageIndex !== -1) {
                const updatedMessages = [...channel.messages];
                updatedMessages.splice(messageIndex, 1);
                updatedChannels.set(channelId, { ...channel, messages: updatedMessages });
                logger.log(`Communities: Deleted message ${deletedEventId} from channel ${channelId}`);
                updatedCommunity.channels = updatedChannels;
                newCommunities.set(simpleCommunityId, updatedCommunity);
                return newCommunities;
              }
            }
            break;
          }
        }

        return prev;
      });
    }
  }, [user, communities, addMessageToChannel]);

  // Start community messages subscription for all loaded communities
  const startCommunityMessagesSubscription = useCallback(async (communitiesToUse?: Map<string, CommunityData>) => {
    const communitiesForSubscription = communitiesToUse || communities;
    logger.log(`[CHANNEL-DEBUG] startCommunityMessagesSubscription called with ${communitiesForSubscription.size} communities`);
    if (!user?.pubkey || !nostr || communitiesForSubscription.size === 0) {
      logger.log('[CHANNEL-DEBUG] Cannot start subscription - missing requirements:', {
        hasUser: !!user,
        hasPubkey: !!user?.pubkey,
        hasNostr: !!nostr,
        communitiesSize: communitiesForSubscription.size
      });
      return;
    }

    // Close existing subscription
    if (communityMessagesSubscriptionRef.current) {
      communityMessagesSubscriptionRef.current.close();
      logger.log('Communities: Closed existing community messages subscription');
    }

    try {
      // Build filters for all communities (one per community, not per channel)
      const communityRefs: string[] = []; // Full addressable format for all events

      communitiesForSubscription.forEach((community) => {
        communityRefs.push(community.fullAddressableId); // e.g., "34550:pubkey:universes"
      });

      if (communityRefs.length === 0) {
        logger.log('Communities: No community references to subscribe to');
        return;
      }

      // Use in-memory lastSync timestamp (consistent with DM pattern)
      let subscriptionSince = Math.floor(Date.now() / 1000) - 30; // Default to 30 seconds ago to catch recent events

      if (communitiesLastSync) {
        // Start subscription from 60 seconds before last cache write (accounts for debounced saves)
        subscriptionSince = Math.floor(communitiesLastSync / 1000) - 60;
        logger.log(`Communities: Using in-memory lastSync timestamp for subscription: ${new Date(communitiesLastSync).toISOString()}`);
      } else {
        logger.log('Communities: No lastSync timestamp available, using 30 seconds ago to catch recent events');
      }

      // All community-related events now use full addressable format
      const filters = [
        {
          kinds: [9411], // Channel messages
          '#a': communityRefs,
          since: subscriptionSince,
        },
        {
          kinds: [1111], // Replies
          '#a': communityRefs,
          since: subscriptionSince,
        },
        {
          kinds: [7, 9735], // Reactions and Zaps
          '#a': communityRefs,
          since: subscriptionSince,
        },
        {
          kinds: [32807], // Channel creation
          '#a': communityRefs,
          since: subscriptionSince,
        },
        {
          kinds: [5], // Deletion events
          '#a': communityRefs,
          since: subscriptionSince,
        },
      ];

      logger.log(`Communities: Starting subscription for ${communityRefs.length} communities since ${new Date(subscriptionSince * 1000).toISOString()}`);

      const subscription = nostr.req(filters);
      let isActive = true;

      // Process messages
      (async () => {
        try {
          for await (const msg of subscription) {
            if (!isActive) break;
            if (msg[0] === 'EVENT') {
              logger.log(`Communities: Received event: ${msg[2].id} (kind: ${msg[2].kind})`);
              await processIncomingCommunityMessage(msg[2], communitiesForSubscription);
            } else {
              logger.log(`Communities: Received non-event message:`, msg);
            }
          }
        } catch (error) {
          if (isActive) {
            logger.error('Communities: Subscription error:', error);
          }
        }
      })();

      communityMessagesSubscriptionRef.current = {
        close: () => {
          isActive = false;
          logger.log('Communities: Community messages subscription closed');
        }
      };

      logger.log('Communities: Community messages subscription started successfully');

    } catch (error) {
      logger.error('Communities: Failed to start community messages subscription:', error);
    }
  }, [user, nostr, communities, communitiesLastSync, processIncomingCommunityMessage]);

  // Process incoming community management events
  const processIncomingCommunityManagementEvent = useCallback(async (event: NostrEvent) => {
    if (!user?.pubkey) return;

    logger.log(`Communities: Processing management event: ${event.id} (kind: ${event.kind})`);

    switch (event.kind) {
      case 34550: {
        // Community definition update
        const communityId = getTagValue(event, 'd');
        if (!communityId) {
          logger.warn(`Communities: No community ID found in definition update ${event.id}`);
          return;
        }

        const community = communities.get(communityId);
        if (!community) {
          logger.log(`Communities: Community ${communityId} not found for definition update`);
          return;
        }

        // Parse updated community info using helper functions
        const name = getTagValue(event, 'name') || communityId;
        const description = getTagValue(event, 'description');
        const image = getTagValue(event, 'image');
        const banner = getTagValue(event, 'banner');
        const moderators = getTagValueWithRole(event, 'p', 'moderator');
        const relays = getTagValues(event, 'relay');

        // Update community info
        setCommunities(prev => {
          const newCommunities = new Map(prev);
          const updatedCommunity = {
            ...community,
            info: { name, description, image, banner, moderators, relays },
            definitionEvent: event,
            lastActivity: Math.max(community.lastActivity, event.created_at),
          };
          newCommunities.set(communityId, updatedCommunity);

          logger.log(`Communities: Updated definition for community ${communityId}: ${name}`);
          return newCommunities;
        });
        break;
      }

      case 34551:
      case 34552:
      case 34553: {
        // Member list updates
        const communityRef = getTagValue(event, 'd');
        if (!communityRef) {
          logger.warn(`Communities: No community reference found in member list update ${event.id}`);
          return;
        }

        // Extract community ID from full addressable format
        const [, , communityId] = communityRef.split(':');
        if (!communityId) {
          logger.warn(`Communities: Invalid community reference format: ${communityRef}`);
          return;
        }

        const community = communities.get(communityId);
        if (!community) {
          logger.log(`Communities: Community ${communityId} not found for member list update`);
          return;
        }

        // Parse member list using helper function
        const members = getTagValues(event, 'p');
        const membersList: MembersList = { members, event };

        // Update appropriate member list
        setCommunities(prev => {
          const newCommunities = new Map(prev);
          const updatedCommunity = { ...community };

          switch (event.kind) {
            case 34551: {
              updatedCommunity.approvedMembers = membersList;

              // Recalculate pending members (join requests minus declined AND approved)
              const approvedJoinRequests = updatedCommunity.pendingMembers?.joinRequests || [];
              const approvedJoinRequestPubkeys = approvedJoinRequests.map(req => req.pubkey);
              const newApprovedPubkeys = members;
              const existingDeclinedPubkeys = updatedCommunity.declinedMembers?.members || [];
              const recalculatedPendingPubkeys = approvedJoinRequestPubkeys.filter(pubkey =>
                !existingDeclinedPubkeys.includes(pubkey) && !newApprovedPubkeys.includes(pubkey)
              );

              updatedCommunity.pendingMembers = recalculatedPendingPubkeys.length > 0 ? {
                members: recalculatedPendingPubkeys,
                event: approvedJoinRequests[0] || null,
                joinRequests: approvedJoinRequests.filter(req => recalculatedPendingPubkeys.includes(req.pubkey))
              } : null;

              logger.log(`Communities: Updated approved members for ${communityId}: ${members.length} approved, ${recalculatedPendingPubkeys.length} still pending`);
              break;
            }
            case 34552: {
              // Kind 34552 is declined members, not pending
              // Store declined members and recalculate pending members (join requests minus declined AND approved)
              updatedCommunity.declinedMembers = membersList;

              const declinedJoinRequests = updatedCommunity.pendingMembers?.joinRequests || [];
              const declinedJoinRequestPubkeys = declinedJoinRequests.map(req => req.pubkey);
              const newDeclinedPubkeys = members;
              const existingApprovedPubkeys = updatedCommunity.approvedMembers?.members || [];
              const recalculatedPendingFromDeclined = declinedJoinRequestPubkeys.filter(pubkey =>
                !newDeclinedPubkeys.includes(pubkey) && !existingApprovedPubkeys.includes(pubkey)
              );

              updatedCommunity.pendingMembers = recalculatedPendingFromDeclined.length > 0 ? {
                members: recalculatedPendingFromDeclined,
                event: declinedJoinRequests[0] || null,
                joinRequests: declinedJoinRequests.filter(req => recalculatedPendingFromDeclined.includes(req.pubkey))
              } : null;

              logger.log(`Communities: Updated declined members for ${communityId}: ${members.length} declined, ${recalculatedPendingFromDeclined.length} still pending`);
              break;
            }
            case 34553:
              updatedCommunity.bannedMembers = membersList;

              // Check if current user is in the banned list
              if (user?.pubkey && members.includes(user.pubkey)) {
                updatedCommunity.membershipStatus = 'banned';
                logger.warn(`Communities: Current user has been banned from community ${communityId}`);
              }

              logger.log(`Communities: Updated banned members for ${communityId}: ${members.length} members`);
              break;
          }

          updatedCommunity.lastActivity = Math.max(community.lastActivity, event.created_at);
          newCommunities.set(communityId, updatedCommunity);
          return newCommunities;
        });
        break;
      }

      case 30143: {
        // Channel permission update
        const permissionRef = getTagValue(event, 'd');
        if (!permissionRef) {
          logger.warn(`Communities: No permission reference found in permission update ${event.id}`);
          return;
        }

        // Parse permission reference (format: "communityId/channelId")
        const [communityId, channelId] = permissionRef.split('/');
        if (!communityId || !channelId) {
          logger.warn(`Communities: Invalid permission reference format: ${permissionRef}`);
          return;
        }

        const community = communities.get(communityId);
        if (!community) {
          logger.log(`Communities: Community ${communityId} not found for permission update`);
          return;
        }

        const channel = community.channels.get(channelId);
        if (!channel) {
          logger.log(`Communities: Channel ${channelId} not found for permission update`);
          return;
        }

        // Update channel permissions
        setCommunities(prev => {
          const newCommunities = new Map(prev);
          const updatedCommunity = { ...community };
          const updatedChannels = new Map(updatedCommunity.channels);
          const updatedChannel = { ...channel, permissions: event };

          updatedChannels.set(channelId, updatedChannel);
          updatedCommunity.channels = updatedChannels;
          updatedCommunity.lastActivity = Math.max(community.lastActivity, event.created_at);
          newCommunities.set(communityId, updatedCommunity);

          logger.log(`Communities: Updated permissions for channel ${channelId} in community ${communityId}`);
          return newCommunities;
        });
        break;
      }

      default:
        logger.warn(`Communities: Unknown management event kind: ${event.kind}`);
    }
  }, [user, communities]);

  // Start community management subscription (membership changes, community updates, permissions)
  const startCommunityManagementSubscription = useCallback(async () => {
    if (!user?.pubkey || !nostr || communities.size === 0) return;

    // Close existing subscription
    if (communityManagementSubscriptionRef.current) {
      communityManagementSubscriptionRef.current.close();
      logger.log('Communities: Closed existing management subscription');
    }

    try {
      const communityIds: string[] = [];
      const communityRefs: string[] = [];
      const ownerPubkeys: string[] = [];

      communities.forEach((community) => {
        communityIds.push(community.id);
        communityRefs.push(community.fullAddressableId);
        ownerPubkeys.push(community.pubkey);
      });

      const subscriptionSince = communitiesLastSync
        ? Math.floor(communitiesLastSync / 1000) - 60
        : Math.floor(Date.now() / 1000);

      const filters = [
        {
          kinds: [34550], // Community definition updates
          '#d': communityIds,
          since: subscriptionSince,
        },
        {
          kinds: [34551, 34552, 34553], // Member list updates
          '#d': communityRefs,
          since: subscriptionSince,
        },
        {
          kinds: [30143], // Channel permission updates
          authors: ownerPubkeys,
          since: subscriptionSince,
        }
      ];

      logger.log(`Communities: Starting management subscription for ${communities.size} communities`);

      const subscription = nostr.req(filters);
      let isActive = true;

      // Process management events
      (async () => {
        try {
          for await (const msg of subscription) {
            if (!isActive) break;
            if (msg[0] === 'EVENT') {
              await processIncomingCommunityManagementEvent(msg[2]);
            }
          }
        } catch (error) {
          if (isActive) {
            logger.error('Communities: Management subscription error:', error);
          }
        }
      })();

      communityManagementSubscriptionRef.current = {
        close: () => {
          isActive = false;
          logger.log('Communities: Management subscription closed');
        }
      };

      logger.log('Communities: Management subscription started successfully');

    } catch (error) {
      logger.error('Communities: Failed to start management subscription:', error);
    }
  }, [user, nostr, communities, communitiesLastSync, processIncomingCommunityManagementEvent]);

  // Add optimistic community message for immediate UI feedback
  const addOptimisticCommunityMessage = useCallback((communityId: string, channelId: string, content: string, additionalTags: string[][] = []) => {
    if (!user?.pubkey) {
      logger.error('Communities: Cannot add optimistic message, no user pubkey');
      return null;
    }

    const community = communities.get(communityId);
    if (!community) {
      logger.error('Communities: Cannot add optimistic message, community not found:', communityId);
      return null;
    }

    const channel = community.channels.get(channelId);
    if (!channel) {
      logger.error('Communities: Cannot add optimistic message, channel not found:', channelId);
      return null;
    }

    // Build full addressable references matching production format
    const fullCommunityRef = community.fullAddressableId; // "34550:pubkey:communitySlug"
    const fullChannelRef = `${fullCommunityRef}:${channelId}`; // "34550:pubkey:communitySlug:channelSlug"

    // Create optimistic message with proper structure
    const optimisticId = `optimistic-${Date.now()}-${Math.random()}`;
    const optimisticMessage: NostrEvent = {
      id: optimisticId,
      kind: 9411,
      pubkey: user.pubkey,
      created_at: Math.floor(Date.now() / 1000),
      content,
      tags: [
        ["t", fullChannelRef], // Full addressable channel reference
        ["a", fullCommunityRef], // Full addressable community reference
        ...additionalTags,
      ],
      sig: '',
      isSending: true, // Mark as optimistic for UI
      clientFirstSeen: Date.now(), // For animation
    };

    // Use helper function to add optimistic message
    addMessageToChannel(communityId, channelId, optimisticMessage, true);

    return optimisticMessage;
  }, [user, communities, addMessageToChannel]);

  // Delete channel immediately from local state and save to cache
  const deleteChannelImmediately = useCallback((communityId: string, channelId: string) => {
    const community = communities.get(communityId);
    if (!community) {
      logger.error('Communities: Cannot delete channel, community not found:', communityId);
      return;
    }

    const channel = community.channels.get(channelId);
    if (!channel) {
      logger.error('Communities: Cannot delete channel, channel not found:', channelId);
      return;
    }

    logger.log(`Communities: Immediately deleting channel "${channel.info.name}" (${channelId}) from community ${communityId}`);

    // Update state to remove the channel
    setCommunities(prev => {
      const newCommunities = new Map(prev);
      const updatedCommunity = { ...newCommunities.get(communityId)! };
      const updatedChannels = new Map(updatedCommunity.channels);

      // Remove the channel
      updatedChannels.delete(channelId);

      updatedCommunity.channels = updatedChannels;
      newCommunities.set(communityId, updatedCommunity);

      logger.log(`Communities: Deleted channel ${channelId} (${channel.info.name}) from local state`);
      return newCommunities;
    });

    // Trigger immediate cache save
    setShouldSaveCommunitiesImmediately(true);
  }, [communities]);

  // Member management functions
  const approveMember = useCallback(async (communityId: string, memberPubkey: string) => {
    if (!user?.pubkey) {
      throw new Error('User must be logged in to manage members');
    }

    const community = communities.get(communityId);
    if (!community) {
      throw new Error('Community not found');
    }

    // Check permissions - only owners and moderators can approve members
    const canModerate = community.membershipStatus === 'owner' ||
      community.membershipStatus === 'moderator' ||
      community.info.moderators.includes(user.pubkey) ||
      community.pubkey === user.pubkey;

    if (!canModerate) {
      throw new Error('Only moderators and owners can approve members');
    }

    logger.log(`Communities: Approving member ${memberPubkey} for community ${communityId}`);

    // Get current approved members
    const currentMembers = new Set(community.approvedMembers?.members || []);
    currentMembers.add(memberPubkey);

    // Create new approved members list event
    const fullCommunityId = `34550:${community.pubkey}:${communityId}`;
    const tags = [
      ['d', fullCommunityId],
      ...Array.from(currentMembers).map(pubkey => ['p', pubkey])
    ];

    await createEvent({
      kind: 34551, // Approved members list
      content: '',
      tags,
    });

    // Update local state immediately
    setCommunities(prev => {
      const newCommunities = new Map(prev);
      const updatedCommunity = { ...newCommunities.get(communityId)! };

      // Update approved members
      updatedCommunity.approvedMembers = {
        members: Array.from(currentMembers),
        event: { ...updatedCommunity.approvedMembers?.event, tags } as NostrEvent
      };

      // Remove from pending members if present
      if (updatedCommunity.pendingMembers) {
        updatedCommunity.pendingMembers = {
          ...updatedCommunity.pendingMembers,
          members: updatedCommunity.pendingMembers.members.filter(pubkey => pubkey !== memberPubkey)
        };
      }

      newCommunities.set(communityId, updatedCommunity);
      return newCommunities;
    });

    // Trigger immediate cache save
    setShouldSaveCommunitiesImmediately(true);
  }, [communities, user?.pubkey, createEvent]);

  const declineMember = useCallback(async (communityId: string, memberPubkey: string) => {
    if (!user?.pubkey) {
      throw new Error('User must be logged in to manage members');
    }

    const community = communities.get(communityId);
    if (!community) {
      throw new Error('Community not found');
    }

    // Check permissions
    const canModerate = community.membershipStatus === 'owner' ||
      community.membershipStatus === 'moderator' ||
      community.info.moderators.includes(user.pubkey) ||
      community.pubkey === user.pubkey;

    if (!canModerate) {
      throw new Error('Only moderators and owners can decline members');
    }

    logger.log(`Communities: Declining member ${memberPubkey} for community ${communityId}`);

    // Simply remove from pending members (don't add to declined list)
    // Update local state immediately
    setCommunities(prev => {
      const newCommunities = new Map(prev);
      const updatedCommunity = { ...newCommunities.get(communityId)! };

      // Remove from pending members
      if (updatedCommunity.pendingMembers) {
        updatedCommunity.pendingMembers = {
          ...updatedCommunity.pendingMembers,
          members: updatedCommunity.pendingMembers.members.filter(pubkey => pubkey !== memberPubkey)
        };
      }

      newCommunities.set(communityId, updatedCommunity);
      return newCommunities;
    });

    // Trigger immediate cache save
    setShouldSaveCommunitiesImmediately(true);
  }, [communities, user?.pubkey]);

  const banMember = useCallback(async (communityId: string, memberPubkey: string) => {
    if (!user?.pubkey) {
      throw new Error('User must be logged in to manage members');
    }

    const community = communities.get(communityId);
    if (!community) {
      throw new Error('Community not found');
    }

    // Check permissions
    const canModerate = community.membershipStatus === 'owner' ||
      community.membershipStatus === 'moderator' ||
      community.info.moderators.includes(user.pubkey) ||
      community.pubkey === user.pubkey;

    if (!canModerate) {
      throw new Error('Only moderators and owners can ban members');
    }

    logger.log(`Communities: Banning member ${memberPubkey} for community ${communityId}`);

    // Get current banned members
    const currentBanned = new Set(community.bannedMembers?.members || []);
    currentBanned.add(memberPubkey);

    // Create new banned members list event
    const fullCommunityId = `34550:${community.pubkey}:${communityId}`;
    const tags = [
      ['d', fullCommunityId],
      ...Array.from(currentBanned).map(pubkey => ['p', pubkey])
    ];

    await createEvent({
      kind: 34553, // Banned members list
      content: '',
      tags,
    });

    // Update local state immediately
    setCommunities(prev => {
      const newCommunities = new Map(prev);
      const updatedCommunity = { ...newCommunities.get(communityId)! };

      // Update banned members
      updatedCommunity.bannedMembers = {
        members: Array.from(currentBanned),
        event: { ...updatedCommunity.bannedMembers?.event, tags } as NostrEvent
      };

      // Remove from approved members if present
      if (updatedCommunity.approvedMembers) {
        updatedCommunity.approvedMembers = {
          ...updatedCommunity.approvedMembers,
          members: updatedCommunity.approvedMembers.members.filter(pubkey => pubkey !== memberPubkey)
        };
      }

      // Remove from pending members if present
      if (updatedCommunity.pendingMembers) {
        updatedCommunity.pendingMembers = {
          ...updatedCommunity.pendingMembers,
          members: updatedCommunity.pendingMembers.members.filter(pubkey => pubkey !== memberPubkey)
        };
      }

      newCommunities.set(communityId, updatedCommunity);
      return newCommunities;
    });

    // Trigger immediate cache save
    setShouldSaveCommunitiesImmediately(true);
  }, [communities, user?.pubkey, createEvent]);

  // Add optimistic channel for immediate UI feedback
  const addOptimisticChannel = useCallback((communityId: string, channelName: string, channelType: 'text' | 'voice', folderId?: string, position?: number) => {
    if (!user?.pubkey) {
      logger.error('Communities: Cannot add optimistic channel, no user pubkey');
      return;
    }

    const community = communities.get(communityId);
    if (!community) {
      logger.error('Communities: Cannot add optimistic channel, community not found:', communityId);
      return;
    }

    // Check if channel already exists (use simple channel name like 'general')
    if (community.channels.has(channelName)) {
      logger.warn('Communities: Channel already exists, skipping optimistic add:', channelName);
      return;
    }

    // Create optimistic channel event with loading state
    const optimisticChannelEvent: NostrEvent = {
      id: `optimistic-channel-${Date.now()}-${Math.random()}`,
      kind: 32807,
      pubkey: user.pubkey,
      created_at: Math.floor(Date.now() / 1000),
      content: JSON.stringify({
        name: channelName,
        type: channelType,
        folderId,
        position: position ?? 0,
      }),
      tags: [
        ['d', channelName], // Use simple channel name format (like 'general')
        ['a', communityId], // Use simple community ID
        ['name', channelName],
        ['channel_type', channelType],
        ['position', (position ?? 0).toString()],
        ['t', 'channel'],
        ['alt', `Channel: ${channelName}`],
        ...(folderId ? [['folder', folderId]] : []),
      ],
      sig: '',
      isSending: true, // Mark as optimistic/loading
    };

    // Create optimistic channel data with loading state
    const optimisticChannelData: ChannelData = {
      id: channelName,
      communityId,
      info: {
        name: channelName,
        type: channelType,
        folderId,
        position: position ?? 0,
      },
      definition: optimisticChannelEvent,
      messages: [],
      replies: new Map(),
      reactions: new Map(),
      pinnedMessages: [],
      permissions: null,
      lastActivity: optimisticChannelEvent.created_at,
      // Initialize pagination state
      hasMoreMessages: true,
      isLoadingOlderMessages: false,
      reachedStartOfConversation: false,
    };

    // Add to community channels
    setCommunities(prev => {
      const updatedCommunity = { ...prev.get(communityId)! };
      const updatedChannels = new Map(updatedCommunity.channels);
      updatedChannels.set(channelName, optimisticChannelData);
      updatedCommunity.channels = updatedChannels;
      updatedCommunity.lastActivity = Math.max(updatedCommunity.lastActivity, optimisticChannelEvent.created_at);

      const newCommunities = new Map(prev);
      newCommunities.set(communityId, updatedCommunity);

      logger.log(`Communities: Added optimistic channel "${channelName}" to community ${communityId}`);
      return newCommunities;
    });
  }, [user, communities]);

  // Main method to start message loading for all enabled protocols
  const startMessageLoading = useCallback(async () => {
    // Prevent multiple simultaneous executions
    if (isLoading) {
      logger.log('DMS: DataManager: Message loading already in progress, skipping duplicate request');
      return;
    }

    logger.log('DMS: DataManager: Starting message loading for all enabled protocols');
    setIsLoading(true);
    setLoadingPhase(LOADING_PHASES.CACHE);

    try {
      // Stage 1: Load from cache for all protocols
      logger.log('DMS: DataManager: Stage 1: Loading cached messages for all protocols');
      const nip4SinceTimestamp = await loadPreviousCachedMessages(MESSAGE_PROTOCOL.NIP04);
      const nip17SinceTimestamp = settings.enableNIP17 ? await loadPreviousCachedMessages(MESSAGE_PROTOCOL.NIP17) : undefined;

      // Stage 2: Query relays for all protocols
      logger.log('DMS: DataManager: Stage 2: Querying relays for new messages');
      setLoadingPhase(LOADING_PHASES.RELAYS);

      // Always query NIP-4 relays for new messages (even if no cached messages)
      const nip4Result = await queryRelaysForMessagesSince(MESSAGE_PROTOCOL.NIP04, nip4SinceTimestamp);

      // Query NIP-17 relays if enabled (even if no cached messages)
      let nip17Result: { lastMessageTimestamp?: number; messageCount: number } | undefined;
      if (settings.enableNIP17) {
        nip17Result = await queryRelaysForMessagesSince(MESSAGE_PROTOCOL.NIP17, nip17SinceTimestamp);
      }

      // If we got new messages from either protocol, trigger immediate save
      const totalNewMessages = nip4Result.messageCount + (nip17Result?.messageCount || 0);
      if (totalNewMessages > 0) {
        logger.log(`DMS: DataManager: Found ${totalNewMessages} new messages from relays (NIP-4: ${nip4Result.messageCount}, NIP-17: ${nip17Result?.messageCount || 0}), will save to IndexedDB after state update`);

        // Set a flag to trigger immediate save when state updates
        setShouldSaveImmediately(true);
      }

      // Stage 3: Set up subscriptions for all protocols
      logger.log('DMS: DataManager: Stage 3: Setting up real-time subscriptions');
      setLoadingPhase(LOADING_PHASES.SUBSCRIPTIONS);

      // Use the timestamp of the last processed message for subscriptions
      // This ensures no gaps between relay queries and subscriptions
      await startNIP4Subscription(nip4Result.lastMessageTimestamp);
      if (settings.enableNIP17) {
        await startNIP17Subscription(nip17Result?.lastMessageTimestamp);
      }

      logger.log('DMS: DataManager: All protocol loading complete');
      setHasInitialLoadCompleted(true);
      setLoadingPhase(LOADING_PHASES.READY);
    } catch (error) {
      logger.error('DMS: DataManager: Error in message loading:', error);
      setLoadingPhase(LOADING_PHASES.READY);
    } finally {
      setIsLoading(false);
    }
  }, [loadPreviousCachedMessages, queryRelaysForMessagesSince, startNIP4Subscription, startNIP17Subscription, settings.enableNIP17, isLoading]);

  // Handle NIP-17 setting changes explicitly
  const handleNIP17SettingChange = useCallback(async (enabled: boolean) => {
    if (!userPubkey) {
      logger.log('DMS: DataManager: No user pubkey available for NIP-17 setting change');
      return;
    }

    if (enabled) {
      // User enabled NIP-17 - load messages now using 3-stage approach
      logger.log('DMS: DataManager: NIP-17 enabled by user, loading messages now');
      const sinceTimestamp = await loadPreviousCachedMessages(MESSAGE_PROTOCOL.NIP17);
      let nip17Result: { lastMessageTimestamp?: number; messageCount: number } | undefined;
      if (sinceTimestamp !== undefined) {
        nip17Result = await queryRelaysForMessagesSince(MESSAGE_PROTOCOL.NIP17, sinceTimestamp);
      }
      await startNIP17Subscription(nip17Result?.lastMessageTimestamp);
    } else {
      // User disabled NIP-17 - clear NIP-17 data and reset sync timestamp
      logger.log('DMS: DataManager: NIP-17 disabled by user, clearing data');
      setLastSync(prev => ({ ...prev, nip17: null }));

      // Close NIP-17 subscription
      if (nip17SubscriptionRef.current) {
        nip17SubscriptionRef.current.close();
        nip17SubscriptionRef.current = null;
        logger.log('DMS: DataManager: Closed NIP-17 subscription due to setting change');
      }

      // Update subscription status
      setSubscriptions(prev => ({ ...prev, nip17: false }));

      // Clear NIP-17 messages from state
      setMessages(prev => {
        const newMap = new Map(prev); // This is fine - just don't mutate objects

        // Process each participant
        prev.forEach((participant, key) => {
          if (participant.hasNIP17) {
            // Remove NIP-17 messages, keep NIP-4 messages
            const nip4Messages = participant.messages.filter(msg => msg.kind === 4);
            if (nip4Messages.length > 0) {
              newMap.set(key, {
                ...participant,
                messages: nip4Messages, // New array reference
                hasNIP17: false,
                lastMessage: nip4Messages[0] || null,
                lastActivity: nip4Messages[0]?.created_at || 0,
              });
            } else {
              // No NIP-4 messages, keep participant but with empty messages
              newMap.set(key, {
                ...participant,
                messages: [], // Empty array instead of deleting
                hasNIP17: false,
                lastMessage: null,
                lastActivity: 0,
              });
            }
          }
          // If no NIP-17 messages, keep as-is (no change needed)
        });

        logger.log(`DMS: DataManager: Cleared NIP-17 data, remaining conversations: ${newMap.size}`);
        return newMap;
      });

      // persist to db, but wait for the state to be updated
      setTimeout(() => {
        writeAllMessagesToStore();
      }, 500);
    }
  }, [loadPreviousCachedMessages, queryRelaysForMessagesSince, startNIP17Subscription, userPubkey]);

  // Track previous NIP-17 setting to detect actual changes
  const prevNIP17Setting = useRef(settings.enableNIP17);

  // Watch for NIP-17 setting changes and handle them explicitly
  useEffect(() => {
    if (!hasInitialLoadCompleted) {
      // Don't handle setting changes until initial load is complete
      return;
    }

    // Only run if the setting actually changed (not on initial mount)
    if (prevNIP17Setting.current !== settings.enableNIP17) {
      logger.log('DMS: DataManager: NIP-17 setting changed from', prevNIP17Setting.current, 'to', settings.enableNIP17);
      handleNIP17SettingChange(settings.enableNIP17);
      prevNIP17Setting.current = settings.enableNIP17;
    }
  }, [settings.enableNIP17, hasInitialLoadCompleted, handleNIP17SettingChange]);

  // ============================================================================
  // Communities Management Functions
  // ============================================================================

  // Load communities the user is a member of with their membership status
  const loadUserCommunities = useCallback(async (): Promise<{
    communities: Array<{
      id: string;
      pubkey: string;
      info: CommunityInfo;
      definitionEvent: NostrEvent;
      membershipStatus: 'approved' | 'pending' | 'banned' | 'owner' | 'moderator';
      membershipEvent: NostrEvent;
    }>;
    timing: {
      membershipQuery: number;
      definitionsQuery: number;
      total: number;
    };
  }> => {
    if (!user?.pubkey) {
      logger.log('Communities: No user pubkey available');
      return { communities: [], timing: { membershipQuery: 0, definitionsQuery: 0, total: 0 } };
    }

    logger.log('Communities: Loading user communities...');
    const startTime = Date.now();

    try {
      // Step 1: Find communities where user is a member (both explicit and implicit) - single efficient query
      const allCommunityEvents = await nostr.query([
        // Filter 1: Find membership lists that include this user (approved + pending + blocked)
        {
          kinds: [34551, 34552, 34553], // Approved + Pending + Blocked members events
          '#p': [user.pubkey], // User is mentioned in the member list
          limit: 1000,
        },
        // Filter 2: Find communities where user is creator/owner
        {
          kinds: [34550], // Community definitions
          authors: [user.pubkey], // User created the community
          limit: 1000,
        },
        // Filter 3: Find communities where user is mentioned as moderator
        {
          kinds: [34550], // Community definitions
          '#p': [user.pubkey], // User is mentioned as moderator
          limit: 1000,
        }
      ], {
        signal: AbortSignal.timeout(15000)
      });

      // Separate the results by event kind
      const membershipEvents = allCommunityEvents.filter(event =>
        [34551, 34552, 34553].includes(event.kind)
      );
      const ownedCommunities = allCommunityEvents.filter(event =>
        event.kind === 34550
      );

      const membershipTime = Date.now() - startTime;

      logger.log(`Communities: Found ${membershipEvents.length} membership records and ${ownedCommunities.length} owned/moderated communities in ${membershipTime}ms`);

      // Extract community IDs from owned/moderated communities
      const ownedCommunityIds = new Set<string>();
      const ownedCommunityMap = new Map<string, { event: NostrEvent; status: 'owner' | 'moderator' }>();

      ownedCommunities.forEach(event => {
        const communityId = event.tags.find(([name]) => name === 'd')?.[1];
        if (!communityId) return;

        // Check if user is creator (owner) or moderator
        const isCreator = event.pubkey === user.pubkey;
        const isModerator = event.tags.some(([name, pubkey, , role]) =>
          name === 'p' && pubkey === user.pubkey && role === 'moderator'
        );

        // We query both by authors and #p to catch all cases:
        // - authors: catches communities where user is creator (even without moderator tag)
        // - #p: catches communities where user is added as moderator by someone else
        if (isCreator || isModerator) {
          ownedCommunityIds.add(communityId);
          // Prioritize creator status over moderator status
          const status = isCreator ? 'owner' : 'moderator';
          ownedCommunityMap.set(communityId, { event, status });
        }
      });

      if (membershipEvents.length === 0 && ownedCommunityIds.size === 0) {
        logger.log('Communities: User is not a member of any communities');
        const totalTime = Date.now() - startTime;
        return { communities: [], timing: { membershipQuery: membershipTime, definitionsQuery: 0, total: totalTime } };
      }

      // Extract community IDs and their membership status from events
      const membershipStatusMap = new Map(
        membershipEvents
          // Extract community ID and determine status
          .map(event => {
            const communityRef = event.tags.find(([name]) => name === 'd')?.[1];
            if (!communityRef) return null;

            const [kind, pubkey, id] = communityRef.split(':');
            if (!kind || !pubkey || !id) {
              logger.warn(`Communities: Invalid community reference format: ${communityRef}`);
              return null;
            }

            const status = (() => {
              switch (event.kind) {
                case 34551: return 'approved' as const;
                case 34552: return 'pending' as const;
                case 34553: return 'banned' as const;
                default:
                  logger.warn(`Communities: Unknown membership event kind ${event.kind}, skipping`);
                  return null;
              }
            })();

            if (status === null) return null;

            logger.log(`Communities: Extracted community ID "${id}" from ref "${communityRef}" with status "${status}"`);
            return [id, { status, event }] as const;
          })
          // Remove invalid entries
          .filter((entry) => !!entry)
      );

      // Combine community IDs from both membership events and owned communities
      const communityIds = new Set([
        ...membershipStatusMap.keys(),
        ...ownedCommunityIds
      ]);

      logger.log(`Communities: User is member of ${communityIds.size} communities (${membershipStatusMap.size} from membership events, ${ownedCommunityIds.size} owned/moderated)`);

      // Step 3: Load community definitions using efficient batch query
      const communityIdArray = Array.from(communityIds);

      if (communityIdArray.length === 0) {
        logger.log('Communities: No community IDs to query');
        const totalTime = Date.now() - startTime;
        return { communities: [], timing: { membershipQuery: membershipTime, definitionsQuery: 0, total: totalTime } };
      }

      logger.log(`Communities: Querying for ${communityIdArray.length} community definitions in single batch...`);

      // Query community definitions - combine with already fetched owned communities
      const definitionsStart = Date.now();

      // Get community IDs that we don't already have definitions for
      const alreadyHaveDefinitions = new Set(ownedCommunities.map(event =>
        event.tags.find(([name]) => name === 'd')?.[1]
      ).filter(Boolean));

      const needDefinitions = communityIdArray.filter(id => !alreadyHaveDefinitions.has(id));

      let additionalDefinitions: NostrEvent[] = [];
      if (needDefinitions.length > 0) {
        additionalDefinitions = await nostr.query([{
          kinds: [34550],
          '#d': needDefinitions, // Query specific community IDs we don't have
        }], {
          signal: AbortSignal.timeout(15000)
        });
      }

      // Combine owned communities with additional definitions
      const communityDefinitions = [...ownedCommunities, ...additionalDefinitions];
      const definitionsTime = Date.now() - definitionsStart;

      logger.log(`Communities: Found ${communityDefinitions.length} community definitions in ${definitionsTime}ms`);
      if (communityDefinitions.length === 0 && communityIdArray.length > 0) {
        logger.log('Communities: No community definitions found despite having membership records. This could mean:');
        logger.log('Communities: 1. Community definitions are on different relays');
        logger.log('Communities: 2. Community definitions have been deleted');
        logger.log('Communities: 3. Query filters are too restrictive');
      }
      // Step 4: Parse community definitions and combine with membership status
      const communitiesWithStatus = communityDefinitions.map(definition => {
        const communityId = definition.tags.find(([name]) => name === 'd')?.[1];

        // Get membership status - check both explicit membership and owned/moderated status
        let membershipStatus: 'approved' | 'pending' | 'banned';
        let membershipEvent: NostrEvent;

        const membershipInfo = membershipStatusMap.get(communityId!);
        const ownedInfo = ownedCommunityMap.get(communityId!);

        if (ownedInfo) {
          // User owns or moderates this community - always approved
          membershipStatus = 'approved';
          membershipEvent = ownedInfo.event;
        } else if (membershipInfo) {
          // User has explicit membership
          membershipStatus = membershipInfo.status;
          membershipEvent = membershipInfo.event;
        } else {
          // This shouldn't happen, but fallback
          logger.warn(`Communities: No membership info found for community ${communityId}`);
          return null;
        }

        // Parse community metadata from tags
        const name = definition.tags.find(([name]) => name === 'name')?.[1] || communityId!;
        const description = definition.tags.find(([name]) => name === 'description')?.[1];
        const image = definition.tags.find(([name]) => name === 'image')?.[1];
        const banner = definition.tags.find(([name]) => name === 'banner')?.[1];

        // Get moderators and relays
        const moderators = definition.tags
          .filter(([name, , , role]) => name === 'p' && role === 'moderator')
          .map(([, pubkey]) => pubkey);

        const relays = definition.tags
          .filter(([name]) => name === 'relay')
          .map(([, url]) => url);

        return {
          id: communityId!,
          pubkey: definition.pubkey,
          info: {
            name,
            description,
            image,
            banner,
            moderators,
            relays,
          },
          definitionEvent: definition,
          membershipStatus,
          membershipEvent,
        };
      }).filter(community => !!community);

      const totalTime = Date.now() - startTime;
      return {
        communities: communitiesWithStatus,
        timing: {
          membershipQuery: membershipTime,
          definitionsQuery: definitionsTime,
          total: totalTime,
        },
      };
    } catch (error) {
      logger.error('Communities: Error loading communities:', error);
      const totalTime = Date.now() - startTime;
      return { communities: [], timing: { membershipQuery: 0, definitionsQuery: 0, total: totalTime } };
    }
  }, [user?.pubkey, nostr]);




  // Main communities loading function with progressive loading
  const startCommunitiesLoading = useCallback(async (isBackgroundRefresh = false) => {
    if (!user?.pubkey) {
      logger.log('Communities: No user pubkey available, skipping communities loading');
      return;
    }

    if (communitiesLoading && !isBackgroundRefresh) {
      logger.log('Communities: Loading already in progress, skipping duplicate request');
      return;
    }

    const startTime = Date.now();
    logger.log(`Communities: Starting communities loading process${isBackgroundRefresh ? ' (background refresh)' : ''}`);

    // Only show loading states for non-background refreshes
    if (!isBackgroundRefresh) {
      setCommunitiesLoading(true);
      setCommunitiesLoadingPhase(LOADING_PHASES.RELAYS);
    }

    try {
      // Step 1: Load communities with membership status
      const step1Start = Date.now();
      const { communities: communitiesWithStatus, timing: step1Timing } = await loadUserCommunities();
      const step1Time = Date.now() - step1Start;

      if (communitiesWithStatus.length === 0) {
        logger.log('Communities: No communities found for user');

        // Set empty communities state and cache it (to avoid re-querying immediately)
        setCommunities(new Map());

        const totalTime = Date.now() - startTime;
        setCommunitiesLoadTime(totalTime);
        setCommunitiesLoadBreakdown({
          step1_communities: {
            total: step1Time,
            membershipQuery: step1Timing.membershipQuery,
            definitionsQuery: step1Timing.definitionsQuery,
          },
          step2_parallel_batch1: {
            total: 0,
            channelsQuery: 0,
            membersQuery: 0,
            joinRequestsQuery: 0,
          },
          step3_parallel_batch2: {
            total: 0,
            permissionsQuery: 0,
            messagesQuery: 0,
          },
          step4_replies_batch: {
            total: 0,
            repliesQuery: 0,
            reactionsQuery: 0,
          },
          step5_pinned_batch: {
            total: 0,
            pinnedQuery: 0,
          },
          total: totalTime,
        });
        setHasCommunitiesInitialLoadCompleted(true);
        setCommunitiesLoading(false);
        setCommunitiesLoadingPhase(LOADING_PHASES.READY);
        return;
      }

      // PROGRESSIVE LOADING: Return communities immediately with isLoadingChannels=true
      logger.log('Communities: Creating initial community state with basic info');
      const initialCommunitiesState = new Map<string, CommunityData>();

      for (const community of communitiesWithStatus) {
        // Determine the user's role in this community
        let finalMembershipStatus = community.membershipStatus;
        if (community.pubkey === userPubkey) {
          finalMembershipStatus = 'owner' as const;
        } else if (community.info.moderators.includes(userPubkey || '')) {
          finalMembershipStatus = 'moderator' as const;
        }

        const communityData: CommunityData = {
          id: community.id,
          fullAddressableId: `34550:${community.pubkey}:${community.id}`,
          pubkey: community.pubkey,
          info: community.info,
          definitionEvent: community.definitionEvent,
          channels: new Map<string, ChannelData>(), // Empty initially
          approvedMembers: null, // Will be loaded in background
          pendingMembers: null, // Will be loaded in background
          declinedMembers: null, // Will be loaded in background
          bannedMembers: null, // Will be loaded in background
          membershipStatus: finalMembershipStatus,
          lastActivity: community.definitionEvent.created_at,
          isLoadingChannels: true, // Indicate channels are still loading
        };

        initialCommunitiesState.set(community.id, communityData);
      }

      // Set initial state so UI can show communities immediately
      setCommunities(initialCommunitiesState);
      logger.log(`Communities: Set initial state with ${initialCommunitiesState.size} communities (channels loading in background)`);

      // Continue loading channels in background for approved communities only
      const approvedCommunities = communitiesWithStatus.filter(({ membershipStatus }) => membershipStatus === 'approved');

      if (approvedCommunities.length === 0) {
        logger.log('Communities: No approved communities, skipping channel loading');
        // Update communities to remove loading flags
        setCommunities(prev => {
          const updated = new Map(prev);
          updated.forEach(community => {
            community.isLoadingChannels = false;
          });
          return updated;
        });


        const totalTime = Date.now() - startTime;
        setCommunitiesLoadTime(totalTime);
        setCommunitiesLoadBreakdown({
          step1_communities: {
            total: step1Time,
            membershipQuery: step1Timing.membershipQuery,
            definitionsQuery: step1Timing.definitionsQuery,
          },
          step2_parallel_batch1: {
            total: 0,
            channelsQuery: 0,
            membersQuery: 0,
            joinRequestsQuery: 0,
          },
          step3_parallel_batch2: {
            total: 0,
            permissionsQuery: 0,
            messagesQuery: 0,
          },
          step4_replies_batch: {
            total: 0,
            repliesQuery: 0,
            reactionsQuery: 0,
          },
          step5_pinned_batch: {
            total: 0,
            pinnedQuery: 0,
          },
          total: totalTime,
        });
        setHasCommunitiesInitialLoadCompleted(true);
        setCommunitiesLoading(false);
        setCommunitiesLoadingPhase(LOADING_PHASES.READY);
        return;
      }

      // BACKGROUND LOADING: Load channels, permissions, and messages in parallel
      logger.log('Communities: Loading channels, permissions, and messages in parallel...');

      // Prepare all filters for parallel execution
      // NOTE: Channels use full addressable format for 'a' tag: ['a', '34550:pubkey:universes']
      const allChannelFilters = approvedCommunities.map(({ definitionEvent, pubkey }) => {
        const communityId = definitionEvent.tags.find(([name]) => name === 'd')?.[1];
        if (!communityId) return null;

        const fullAddressableId = `34550:${pubkey}:${communityId}`;

        return {
          kinds: [32807], // Channel definitions
          '#a': [fullAddressableId],
          '#t': ['channel'], // Filter for channel events specifically
          limit: 50, // Max channels per community
        };
      }).filter((filter): filter is NonNullable<typeof filter> => filter !== null);

      const allMemberFilters = communitiesWithStatus.map(({ definitionEvent }) => {
        const communityId = definitionEvent.tags.find(([name]) => name === 'd')?.[1];
        const communityRef = `34550:${definitionEvent.pubkey}:${communityId}`;
        return {
          kinds: [34551], // Approved members events
          authors: [definitionEvent.pubkey],
          '#d': [communityRef],
          limit: 1,
        };
      });

      // Add join requests filters (kind 4552)
      const allJoinRequestFilters = communitiesWithStatus.map(({ definitionEvent }) => {
        const communityId = definitionEvent.tags.find(([name]) => name === 'd')?.[1];
        const communityRef = `34550:${definitionEvent.pubkey}:${communityId}`;
        return {
          kinds: [4552], // Join request events
          '#a': [communityRef],
          limit: 100, // Allow more join requests
          since: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60), // Last 30 days
        };
      });

      // BATCH 1: Execute channels, members, and join requests queries in parallel
      const batch1Start = Date.now();

      // Wrap each query with individual timing
      const channelsQueryPromise = (async () => {
        const start = Date.now();
        const result = await nostr.query(allChannelFilters, { signal: AbortSignal.timeout(15000) });
        const time = Date.now() - start;
        return { result, time };
      })();

      const membersQueryPromise = (async () => {
        const start = Date.now();
        const result = await nostr.query(allMemberFilters, { signal: AbortSignal.timeout(15000) });
        const time = Date.now() - start;
        return { result, time };
      })();

      const joinRequestsQueryPromise = (async () => {
        const start = Date.now();
        const result = allJoinRequestFilters.length > 0
          ? await nostr.query(allJoinRequestFilters, { signal: AbortSignal.timeout(15000) })
          : [];
        const time = Date.now() - start;
        return { result, time };
      })();

      const [channelsQueryResult, membersQueryResult, joinRequestsQueryResult] = await Promise.all([
        channelsQueryPromise,
        membersQueryPromise,
        joinRequestsQueryPromise
      ]);

      const batch1Time = Date.now() - batch1Start;
      let allChannelDefinitions = channelsQueryResult.result;
      const allMemberLists = membersQueryResult.result;
      const allJoinRequests = joinRequestsQueryResult.result;
      const channelsQueryTime = channelsQueryResult.time;
      const membersQueryTime = membersQueryResult.time;
      const joinRequestsQueryTime = joinRequestsQueryResult.time;

      // Add missing "general" channels for each approved community (if enabled)
      const additionalGeneralChannels: NostrEvent[] = [];
      if (ALWAYS_ADD_GENERAL_CHANNEL) {
        for (const community of approvedCommunities) {
          const communityId = community.definitionEvent.tags.find(([name]) => name === 'd')?.[1];
          if (!communityId) continue;

          // Check if this community already has a "general" channel
          const existingChannels = allChannelDefinitions.filter(channelDef => {
            const channelCommunityRef = channelDef.tags.find(([name]) => name === 'a')?.[1];
            return channelCommunityRef === communityId || channelCommunityRef?.includes(`:${communityId}`);
          });

          logger.log(`Communities: Community ${communityId} has ${existingChannels.length} existing channels:`,
            existingChannels.map(ch => ({
              id: ch.tags.find(([name]) => name === 'd')?.[1],
              name: ch.tags.find(([name]) => name === 'name')?.[1]
            }))
          );

          const hasGeneralChannel = existingChannels.some(channelDef => {
            const channelId = channelDef.tags.find(([name]) => name === 'd')?.[1];
            const channelName = channelDef.tags.find(([name]) => name === 'name')?.[1];
            const isGeneralChannel = channelId === 'general' || channelName?.toLowerCase() === 'general';

            if (isGeneralChannel) {
              logger.log(`Communities: Found existing general channel for ${communityId}: id=${channelId}, name=${channelName}`);
            }

            return isGeneralChannel;
          });

          if (!hasGeneralChannel) {
            // Create a synthetic "general" channel definition
            const properCommunityRef = `34550:${community.pubkey}:${communityId}`;
            const generalChannelEvent: NostrEvent = {
              id: `synthetic-general-${communityId}`,
              kind: 32807,
              pubkey: community.pubkey,
              created_at: community.definitionEvent.created_at,
              content: JSON.stringify({
                name: 'general',
                description: 'General discussion',
                type: 'text',
                position: 0,
              }),
              tags: [
                ['d', 'general'],
                ['a', properCommunityRef],
                ['t', 'channel'],
                ['name', 'general'],
                ['description', 'General discussion'],
                ['channel_type', 'text'],
                ['position', '0'],
              ],
              sig: '',
            };

            additionalGeneralChannels.push(generalChannelEvent);
            logger.log(`Communities: Added synthetic "general" channel for community ${communityId}`);
          }
        }
      }

      // Add the synthetic general channels to the channel definitions
      allChannelDefinitions = [...allChannelDefinitions, ...additionalGeneralChannels];

      // Group channels by community to create ONE filter per community instead of one per channel
      const channelsByCommunity = new Map<string, Array<{
        dTag: string;
        channelId: string;
        communityRef: string;
        communityPubkey: string;
        communityId: string;
      }>>();

      allChannelDefinitions.forEach(channelDef => {
        const communityRef = channelDef.tags.find(([name]) => name === 'a')?.[1];
        const dTag = channelDef.tags.find(([name]) => name === 'd')?.[1];
        if (!communityRef || !dTag) return;

        // Extract channel ID from d tag
        const channelId = dTag.includes(':') ? dTag.split(':').pop()! : dTag;

        // Parse community reference to get proper format
        let properCommunityRef: string;
        let communityPubkey: string;
        let communityId: string;

        if (communityRef.includes(':')) {
          // Already in proper format (34550:pubkey:id)
          properCommunityRef = communityRef;
          const parts = communityRef.split(':');
          communityPubkey = parts[1];
          communityId = parts[2];
        } else {
          // Legacy simple format - need to construct proper reference
          const community = communitiesWithStatus.find(c => c.id === communityRef);
          if (community) {
            properCommunityRef = `34550:${community.pubkey}:${communityRef}`;
            communityPubkey = community.pubkey;
            communityId = communityRef;
          } else {
            return; // Skip if we can't find community
          }
        }

        if (!channelsByCommunity.has(communityId)) {
          channelsByCommunity.set(communityId, []);
        }

        channelsByCommunity.get(communityId)!.push({
          dTag,
          channelId,
          communityRef: properCommunityRef,
          communityPubkey,
          communityId,
        });
      });

      // Create ONE permission filter per community with all channel d-tags
      const allPermissionFilters = Array.from(channelsByCommunity.entries()).map(([_communityId, channels]) => ({
        kinds: [30143], // Channel permissions events
        authors: [channels[0].communityPubkey],
        '#d': channels.map(ch => `${ch.communityId}/${ch.channelId}`), // All channels in one filter
        limit: channels.length * 2, // Generous limit for all channels
      }));

      // Create ONE filter PER CHANNEL (matching production event format)
      // Each channel gets its own query with full addressable format for both 'a' and 't' tags
      const allMessageFilters = Array.from(channelsByCommunity.entries()).flatMap(([_communityId, channels]) => 
        channels.map(ch => {
          // Build the full addressable channel reference: "34550:pubkey:communitySlug:channelSlug"
          const fullChannelRef = `${ch.communityRef}:${ch.channelId}`;
          
          return {
            kinds: [9411],
            '#a': [ch.communityRef], // "34550:pubkey:communitySlug"
            '#t': [fullChannelRef], // "34550:pubkey:communitySlug:channelSlug"
            limit: MESSAGES_PER_PAGE,
          };
        })
      );

      logger.log(`Communities: Created ${allPermissionFilters.length} permission filters and ${allMessageFilters.length} message filters (1 per channel)`);
      
      // DEBUG: Log sample message filters to verify format
      if (allMessageFilters.length > 0) {
        logger.log('Communities: Sample message filters:', allMessageFilters.slice(0, 3));
      }

      // BATCH 2: Execute permissions, messages, and pinned posts queries in parallel
      const batch2Start = Date.now();

      // Collect all channel identifiers for pinned posts query
      const channelIdentifiers: string[] = [];
      for (const [communityId, community] of initialCommunitiesState) {
        for (const [channelId, _channel] of community.channels) {
          channelIdentifiers.push(`${communityId}:${channelId}`);
        }
      }

      // Wrap each query with individual timing
      const permissionsQueryPromise = (async () => {
        const start = Date.now();
        const result = allPermissionFilters.length > 0
          ? await nostr.query(allPermissionFilters, { signal: AbortSignal.timeout(15000) })
          : [];
        const time = Date.now() - start;
        return { result, time };
      })();

      const messagesQueryPromise = (async () => {
        const start = Date.now();
        const result = allMessageFilters.length > 0
          ? await nostr.query(allMessageFilters, { signal: AbortSignal.timeout(15000) })
          : [];
        const time = Date.now() - start;
        return { result, time };
      })();

      const pinnedPostsQueryPromise = (async () => {
        const start = Date.now();
        const result = channelIdentifiers.length > 0
          ? await nostr.query([{
            kinds: [34554], // Pinned posts
            '#d': channelIdentifiers,
            // No limit - get all pinned posts
          }], { signal: AbortSignal.timeout(10000) })
          : [];
        const time = Date.now() - start;
        return { result, time };
      })();

      const [permissionsQueryResult, messagesQueryResult, pinnedPostsQueryResult] = await Promise.all([
        permissionsQueryPromise,
        messagesQueryPromise,
        pinnedPostsQueryPromise
      ]);

      const batch2Time = Date.now() - batch2Start;
      const allPermissionSettings = permissionsQueryResult.result;
      const allChannelMessages = messagesQueryResult.result;
      const allPinnedPostsEvents = pinnedPostsQueryResult.result;
      const permissionsQueryTime = permissionsQueryResult.time;
      const messagesQueryTime = messagesQueryResult.time;
      const pinnedPostsQueryTime = pinnedPostsQueryResult.time;

      // DEBUG: Log message query results
      logger.log(`Communities: Messages query returned ${allChannelMessages.length} messages`);
      if (allChannelMessages.length > 0) {
        logger.log('Communities: First message sample:', {
          id: allChannelMessages[0].id.slice(0, 8),
          kind: allChannelMessages[0].kind,
          aTags: allChannelMessages[0].tags.filter(([name]) => name === 'a'),
          tTags: allChannelMessages[0].tags.filter(([name]) => name === 't'),
        });
      }

      // BATCH 3: Get replies (kind 1111), reactions/zaps (kinds 7, 9735), and pinned messages in parallel
      const batch3Start = Date.now();
      const messageIds = allChannelMessages.map(msg => msg.id);

      // Extract all pinned message IDs from pinned posts events we already fetched
      const allPinnedMessageIds = allPinnedPostsEvents.flatMap(event =>
        event.tags.filter(([name]) => name === 'e').map(([, eventId]) => eventId)
      );

      // Remove duplicates
      const uniquePinnedMessageIds = [...new Set(allPinnedMessageIds)];

      let allReplies: NostrEvent[] = [];
      let allReactionsAndZaps: NostrEvent[] = [];
      let pinnedMessages: NostrEvent[] = [];
      let repliesQueryTime = 0;
      let reactionsQueryTime = 0;
      let pinnedMessagesQueryTime = 0;

      if (messageIds.length > 0) {
        // Query for replies and reactions/zaps in parallel (keep existing structure)
        const repliesQueryPromise = (async () => {
          const start = Date.now();
          const result = await nostr.query([{
            kinds: [1111], // Reply/comment events
            '#e': messageIds, // Replies to our messages
            // No limit - get all replies to our messages
          }], { signal: AbortSignal.timeout(10000) });
          const time = Date.now() - start;
          return { result, time };
        })();

        const reactionsQueryPromise = (async () => {
          const start = Date.now();
          const result = await nostr.query([{
            kinds: [7, 9735], // Reaction events and Zap receipts
            '#e': messageIds, // Reactions/zaps to our messages
            // No limit - get all reactions/zaps to our messages
          }], { signal: AbortSignal.timeout(10000) });
          const time = Date.now() - start;
          return { result, time };
        })();

        const [repliesResult, reactionsResult] = await Promise.all([
          repliesQueryPromise,
          reactionsQueryPromise
        ]);

        allReplies = repliesResult.result;
        allReactionsAndZaps = reactionsResult.result;
        repliesQueryTime = repliesResult.time;
        reactionsQueryTime = reactionsResult.time;
      }

      // Query for pinned message events (simple addition)
      if (uniquePinnedMessageIds.length > 0) {
        const pinnedMessagesQueryPromise = (async () => {
          const start = Date.now();
          const result = await nostr.query([{
            ids: uniquePinnedMessageIds
          }], { signal: AbortSignal.timeout(10000) });
          const time = Date.now() - start;
          return { result, time };
        })();

        const pinnedMessagesResult = await pinnedMessagesQueryPromise;
        pinnedMessages = pinnedMessagesResult.result;
        pinnedMessagesQueryTime = pinnedMessagesResult.time;
      }

      const batch3Time = Date.now() - batch3Start;

      // Organize pinned messages by channel for efficient lookup
      const pinnedMessagesByChannel = new Map<string, NostrEvent[]>();

      // Group pinned posts events by channel and map to actual messages
      allPinnedPostsEvents.forEach(pinnedPostEvent => {
        const dTag = pinnedPostEvent.tags.find(([name]) => name === 'd')?.[1];
        if (!dTag) return;

        const channelKey = dTag; // dTag is already in format "communityId:channelId"
        const pinnedMessageIds = pinnedPostEvent.tags
          .filter(([name]) => name === 'e')
          .map(([, eventId]) => eventId);

        // Find the actual pinned messages for this channel
        const channelPinnedMessages = pinnedMessages.filter(msg =>
          pinnedMessageIds.includes(msg.id)
        );

        pinnedMessagesByChannel.set(channelKey, channelPinnedMessages);
      });

      const totalParallelTime = batch1Time + batch2Time + batch3Time;

      logger.log(`Communities: All batches complete in ${totalParallelTime}ms - Batch 1: ${batch1Time}ms, Batch 2: ${batch2Time}ms, Batch 3: ${batch3Time}ms - Results: Channels: ${allChannelDefinitions.length}, Members: ${allMemberLists.length}, Permissions: ${allPermissionSettings.length}, Messages: ${allChannelMessages.length}, Replies: ${allReplies.length}, Reactions/Zaps: ${allReactionsAndZaps.length}, Pinned: ${pinnedMessages.length}`);

      // Organize replies by message ID for efficient lookup
      const repliesByMessageId = new Map<string, NostrEvent[]>();
      allReplies.forEach(reply => {
        const eTags = reply.tags.filter(([name]) => name === 'e');
        eTags.forEach(([, messageId]) => {
          if (!repliesByMessageId.has(messageId)) {
            repliesByMessageId.set(messageId, []);
          }
          repliesByMessageId.get(messageId)!.push(reply);
        });
      });

      // Sort replies by timestamp for each message
      repliesByMessageId.forEach(replies => {
        replies.sort((a, b) => a.created_at - b.created_at);
      });

      // Organize reactions/zaps by message ID for efficient lookup
      const reactionsByMessageId = new Map<string, NostrEvent[]>();
      allReactionsAndZaps.forEach(reaction => {
        const eTags = reaction.tags.filter(([name]) => name === 'e');
        eTags.forEach(([, messageId]) => {
          if (!reactionsByMessageId.has(messageId)) {
            reactionsByMessageId.set(messageId, []);
          }
          reactionsByMessageId.get(messageId)!.push(reaction);
        });
      });

      // Sort reactions by timestamp for each message
      reactionsByMessageId.forEach(reactions => {
        reactions.sort((a, b) => a.created_at - b.created_at);
      });

      logger.log(`Communities: Organized ${allReplies.length} replies for ${repliesByMessageId.size} messages and ${allReactionsAndZaps.length} reactions/zaps for ${reactionsByMessageId.size} messages`);

      // Build final communities state with loaded channel data
      const updatedCommunitiesState = new Map<string, CommunityData>();

      for (const community of communitiesWithStatus) {
        const isApproved = community.membershipStatus === 'approved';
        const channelsMap = new Map<string, ChannelData>();

        // Only load channels/messages for approved communities
        if (isApproved) {
          // Find channels for this community
          const communityChannels = allChannelDefinitions.filter(channelDef => {
            const communityRef = channelDef.tags.find(([name]) => name === 'a')?.[1];
            if (!communityRef) return false;

            // Handle both legacy format ("universes") and proper format ("34550:pubkey:universes")
            return communityRef === community.id || communityRef.includes(`:${community.id}`);
          });

          for (const channelDef of communityChannels) {
            const dTag = channelDef.tags.find(([name]) => name === 'd')?.[1];
            if (!dTag) continue;

            // Extract the channel name from the d tag
            // Format can be either "channelName" or "communityId:channelName"
            const channelId = dTag.includes(':') ? dTag.split(':').pop()! : dTag;

            // Find messages for this channel
            const channelMessages = allChannelMessages.filter(msg => {
              const msgCommunityRef = msg.tags.find(([name]) => name === 'a')?.[1];
              const msgChannelTag = msg.tags.find(([name]) => name === 't')?.[1];
              if (!msgCommunityRef || !msgChannelTag) return false;

              // Handle both legacy format ("universes") and proper format ("34550:pubkey:universes")
              const matchesCommunity = msgCommunityRef === community.id || msgCommunityRef.includes(`:${community.id}`);

              if (!matchesCommunity) return false;

              // Only kind 9411 messages
              if (msg.kind !== 9411) return false;

              // Extract channel slug from 't' tag (format: "34550:pubkey:communitySlug:channelSlug")
              const msgChannelId = msgChannelTag.includes(':') ? msgChannelTag.split(':').pop()! : msgChannelTag;

              // Must have matching channel slug
              return msgChannelId === channelId;
            });

            // Find permissions for this channel
            const channelPermissions = allPermissionSettings.find(perm => {
              const permRef = perm.tags.find(([name]) => name === 'd')?.[1];
              return permRef === `${community.id}/${channelId}`;
            });

            // Parse channel info from tags
            const channelName = channelDef.tags.find(([name]) => name === 'name')?.[1] || channelId;
            const channelDescription = channelDef.tags.find(([name]) => name === 'description')?.[1] ||
              channelDef.tags.find(([name]) => name === 'about')?.[1];
            const channelType = channelDef.tags.find(([name]) => name === 'channel_type')?.[1] as 'text' | 'voice' || 'text';
            const folderId = channelDef.tags.find(([name]) => name === 'folder')?.[1];
            const position = parseInt(channelDef.tags.find(([name]) => name === 'position')?.[1] || '0');

            // Try to parse content for additional metadata
            let contentData: ChannelInfo = { name: '', type: 'text' };
            try {
              contentData = JSON.parse(channelDef.content) as ChannelInfo;
            } catch {
              // Ignore parsing errors
            }

            // Build replies map for this channel's messages
            const channelReplies = new Map<string, NostrEvent[]>();
            channelMessages.forEach(message => {
              const messageReplies = repliesByMessageId.get(message.id) || [];
              if (messageReplies.length > 0) {
                channelReplies.set(message.id, messageReplies);
              }
            });

            // Build reactions map for this channel's messages
            const channelReactions = new Map<string, NostrEvent[]>();
            channelMessages.forEach(message => {
              const messageReactions = reactionsByMessageId.get(message.id) || [];
              if (messageReactions.length > 0) {
                channelReactions.set(message.id, messageReactions);
              }
            });

            // Remove unused sortedMessages variable

            // Debug log for messages
            if (channelMessages.length > 0) {
              logger.log(`Channel ${channelId} has ${channelMessages.length} messages`);
            }

            // Sort messages by timestamp (oldest first) to match what Virtuoso expects
            const sortedMessages = [...channelMessages].sort((a, b) => a.created_at - b.created_at);

            channelsMap.set(channelId, {
              id: channelId, // Channel ID from d tag
              communityId: community.id,
              info: {
                name: contentData?.name || channelName,
                description: contentData?.description || channelDescription,
                type: contentData?.type || channelType,
                folderId: contentData?.folderId || folderId,
                position: contentData?.position ?? position ?? 0,
              },
              definition: channelDef,
              messages: sortedMessages, // Use sorted messages (oldest first)
              replies: channelReplies,
              reactions: channelReactions,
              pinnedMessages: pinnedMessagesByChannel.get(`${community.id}:${channelId}`) || [],
              permissions: channelPermissions || null,
              lastActivity: sortedMessages.length > 0 ? sortedMessages[sortedMessages.length - 1].created_at : channelDef.created_at,
              // Initialize pagination state
              oldestMessageTimestamp: sortedMessages.length > 0 ? sortedMessages[0].created_at : undefined,
              hasMoreMessages: sortedMessages.length >= MESSAGES_PER_PAGE, // Assume more if we got a full page
              isLoadingOlderMessages: false,
              reachedStartOfConversation: sortedMessages.length < MESSAGES_PER_PAGE, // Reached start if we got less than a full page
            });
          }
        }

        // Find member lists for this community
        const communityRef = `34550:${community.pubkey}:${community.id}`;
        const approvedMembersEvent = allMemberLists.find(memberList => {
          const memberRef = memberList.tags.find(([name]) => name === 'd')?.[1];
          return memberRef === communityRef && memberList.kind === 34551;
        });
        const declinedMembersEvent = allMemberLists.find(memberList => {
          const memberRef = memberList.tags.find(([name]) => name === 'd')?.[1];
          return memberRef === communityRef && memberList.kind === 34552;
        });
        const bannedMembersEvent = allMemberLists.find(memberList => {
          const memberRef = memberList.tags.find(([name]) => name === 'd')?.[1];
          return memberRef === communityRef && memberList.kind === 34553;
        });

        // Parse member lists from events
        const approvedMembers = approvedMembersEvent ? {
          members: approvedMembersEvent.tags.filter(([name]) => name === 'p').map(([, pubkey]) => pubkey),
          event: approvedMembersEvent
        } : null;

        const declinedMembers = declinedMembersEvent ? {
          members: declinedMembersEvent.tags.filter(([name]) => name === 'p').map(([, pubkey]) => pubkey),
          event: declinedMembersEvent
        } : null;

        const bannedMembers = bannedMembersEvent ? {
          members: bannedMembersEvent.tags.filter(([name]) => name === 'p').map(([, pubkey]) => pubkey),
          event: bannedMembersEvent
        } : null;

        // Find join requests for this community (kind 4552)
        const communityJoinRequests = allJoinRequests.filter(joinRequest => {
          const aTag = joinRequest.tags.find(([name]) => name === 'a')?.[1];
          return aTag === communityRef;
        });

        // Create pending members list: join requests minus declined AND approved members
        // 1. Get all individual join requests (kind 4552) - created by users
        // 2. Subtract declined members (kind 34552) - managed by moderators
        // 3. Subtract approved members (kind 34551) - already approved
        const joinRequestPubkeys = communityJoinRequests.map(req => req.pubkey);
        const declinedPubkeys = declinedMembers?.members || [];
        const approvedPubkeys = approvedMembers?.members || [];
        const actualPendingPubkeys = joinRequestPubkeys.filter(pubkey =>
          !declinedPubkeys.includes(pubkey) && !approvedPubkeys.includes(pubkey)
        );

        const combinedPendingMembers = actualPendingPubkeys.length > 0 ? {
          members: actualPendingPubkeys,
          event: communityJoinRequests[0] || null, // Use the first join request as the event
          joinRequests: communityJoinRequests.filter(req => actualPendingPubkeys.includes(req.pubkey)) // Only include non-declined requests
        } : null;

        // Determine the user's role in this community
        let finalMembershipStatus = community.membershipStatus;
        if (community.pubkey === userPubkey) {
          finalMembershipStatus = 'owner' as const;
        } else if (community.info.moderators.includes(userPubkey || '')) {
          finalMembershipStatus = 'moderator' as const;
        }

        const communityData: CommunityData = {
          id: community.id,
          fullAddressableId: `34550:${community.pubkey}:${community.id}`,
          pubkey: community.pubkey,
          info: community.info,
          definitionEvent: community.definitionEvent,
          channels: channelsMap,
          approvedMembers: approvedMembers || null,
          pendingMembers: combinedPendingMembers || null, // Actual pending (join requests minus declined)
          declinedMembers: declinedMembers || null, // Declined members from kind 34552
          bannedMembers: bannedMembers || null, // Banned members from kind 34553
          membershipStatus: finalMembershipStatus,
          lastActivity: isApproved && channelsMap.size > 0
            ? Math.max(community.definitionEvent.created_at, ...Array.from(channelsMap.values()).map(c => c.lastActivity))
            : community.definitionEvent.created_at,
          isLoadingChannels: false, // Channels have finished loading
        };

        updatedCommunitiesState.set(community.id, communityData);
      }

      // Update communities state with loaded channel data and remove loading flags
      setCommunities(updatedCommunitiesState);

      // Flag for immediate cache write after successful network load (like messages do)
      logger.log(`Communities: Successfully loaded ${updatedCommunitiesState.size} communities from network, will save to cache after state update`);
      setShouldSaveCommunitiesImmediately(true);

      const totalTime = Date.now() - startTime;
      setCommunitiesLoadTime(totalTime);
      setCommunitiesLoadBreakdown({
        step1_communities: {
          total: step1Time,
          membershipQuery: step1Timing.membershipQuery,
          definitionsQuery: step1Timing.definitionsQuery,
        },
        step2_parallel_batch1: {
          total: batch1Time,
          channelsQuery: channelsQueryTime,
          membersQuery: membersQueryTime,
          joinRequestsQuery: joinRequestsQueryTime,
        },
        step3_parallel_batch2: {
          total: batch2Time,
          permissionsQuery: permissionsQueryTime,
          messagesQuery: messagesQueryTime,
        },
        step4_replies_batch: {
          total: batch3Time,
          repliesQuery: repliesQueryTime,
          reactionsQuery: reactionsQueryTime,
        },
        step5_pinned_batch: {
          total: 0, // Pinned queries are now integrated into other batches
          pinnedQuery: pinnedPostsQueryTime + pinnedMessagesQueryTime,
        },
        total: totalTime,
      });
      logger.log(`Communities: Successfully loaded ${updatedCommunitiesState.size} communities in ${totalTime}ms (communities: ${step1Time}ms, batch1: ${batch1Time}ms, batch2: ${batch2Time}ms)`);

      if (!isBackgroundRefresh) {
        setHasCommunitiesInitialLoadCompleted(true);
        setCommunitiesLoadingPhase(LOADING_PHASES.READY);

        // Start community subscriptions after successful loading
        logger.log('Communities: Starting subscriptions after successful loading');
        logger.log(`[CHANNEL-DEBUG] Starting subscriptions with ${updatedCommunitiesState.size} communities loaded`);
        startCommunityMessagesSubscription(updatedCommunitiesState);
        startCommunityManagementSubscription();
      }
    } catch (error) {
      logger.error('Communities: Error in communities loading:', error);
      const totalTime = Date.now() - startTime;
      setCommunitiesLoadTime(totalTime);
      if (!isBackgroundRefresh) {
        setCommunitiesLoadingPhase(LOADING_PHASES.READY);
      }
    } finally {
      if (!isBackgroundRefresh) {
        setCommunitiesLoading(false);
      }
    }
  }, [user?.pubkey, communitiesLoading, loadUserCommunities, nostr, startCommunityMessagesSubscription]);

  // Communities debug info
  const getCommunitiesDebugInfo = useCallback(() => {
    let totalChannels = 0;
    let totalMessages = 0;
    let totalReplies = 0;
    let totalReactions = 0;
    let totalPinned = 0;

    communities.forEach((community) => {
      totalChannels += community.channels.size;
      community.channels.forEach((channel) => {
        totalMessages += channel.messages.length;
        channel.replies.forEach((replies) => {
          totalReplies += replies.length;
        });
        channel.reactions.forEach((reactions) => {
          totalReactions += reactions.length;
        });
        totalPinned += channel.pinnedMessages.length;
      });
    });

    return {
      communityCount: communities.size,
      channelCount: totalChannels,
      messageCount: totalMessages,
      replyCount: totalReplies,
      reactionCount: totalReactions,
      pinnedCount: totalPinned,
    };
  }, [communities]);

  // Helper function to parse permissions from NostrEvent
  const parsePermissions = useCallback((permissionsEvent: NostrEvent | null) => {
    if (!permissionsEvent) {
      return {
        readPermissions: 'everyone' as const,
        writePermissions: 'members' as const,
      };
    }

    try {
      const content = JSON.parse(permissionsEvent.content);
      return {
        readPermissions: content.readPermissions || 'everyone',
        writePermissions: content.writePermissions || 'members',
      };
    } catch {
      return {
        readPermissions: 'everyone' as const,
        writePermissions: 'members' as const,
      };
    }
  }, []);

  // Helper function to check channel access based on permissions
  const checkChannelAccess = useCallback((channel: ChannelData, community: CommunityData): boolean => {
    // If no permissions event, assume public access
    if (!channel.permissions) {
      return true;
    }

    const parsedPermissions = parsePermissions(channel.permissions);

    // Owners and moderators always have access
    if (community.membershipStatus === 'owner' || community.membershipStatus === 'moderator') {
      return true;
    }

    // Check read permissions
    switch (parsedPermissions.readPermissions) {
      case 'everyone':
        return true;
      case 'members':
        return ['approved', 'owner', 'moderator'].includes(community.membershipStatus);
      case 'moderators':
        return ['owner', 'moderator'].includes(community.membershipStatus);
      case 'specific':
        // TODO: Check if user is in allowed readers list from permissions event tags
        return true; // For now, assume access
      default:
        return true;
    }
  }, [parsePermissions]);

  // Get sorted channels for a community with all data pre-computed and filtered by access
  const getSortedChannels = useCallback((communityId: string): DisplayChannel[] => {
    const community = communities.get(communityId);
    if (!community) {
      return [];
    }

    // Convert DataManager ChannelData to DisplayChannel format with all data pre-computed
    const channelsArray: DisplayChannel[] = Array.from(community.channels.values())
      .map(channel => {
        const hasAccess = checkChannelAccess(channel, community);
        const parsedPermissions = parsePermissions(channel.permissions);

        // Assert that we can determine access - fail fast if not
        if (hasAccess === undefined || hasAccess === null) {
          throw new Error(`DataManager: Cannot determine access for channel ${channel.id} in community ${communityId}`);
        }

        // Assert that we can parse permissions - fail fast if not
        if (!parsedPermissions) {
          throw new Error(`DataManager: Cannot parse permissions for channel ${channel.id} in community ${communityId}`);
        }

        // Pre-compute restriction check
        const isRestricted =
          parsedPermissions.readPermissions === 'moderators' ||
          parsedPermissions.readPermissions === 'specific' ||
          parsedPermissions.writePermissions === 'moderators' ||
          parsedPermissions.writePermissions === 'specific';

        const displayChannel = {
          id: channel.id, // Simple channel name for URLs (e.g., "general", "design-team")
          name: channel.info.name,
          description: channel.info.description,
          type: channel.info.type,
          communityId: channel.communityId,
          creator: channel.definition.pubkey,
          folderId: channel.info.folderId,
          position: channel.info.position ?? 0, // Default to 0 if undefined
          event: channel.definition,
          permissions: channel.permissions,
          isLoading: channel.definition.isSending, // Show loading for optimistic channels
          hasAccess,
          parsedPermissions,
          isRestricted,
        };
        return displayChannel;
      })
      // Filter out channels the user can't access (unless they're a moderator who can see everything)
      .filter(channel => {
        const canModerate = community.membershipStatus === 'owner' || community.membershipStatus === 'moderator';
        return channel.hasAccess || canModerate;
      });


    // Apply the same sorting logic as useChannels
    return channelsArray.sort((a, b) => {
      // 1. Folder first: Channels without folders come first
      if (a.folderId !== b.folderId) {
        if (!a.folderId) return -1;
        if (!b.folderId) return 1;
        return a.folderId.localeCompare(b.folderId);
      }
      // 2. Then by position: Within the same folder, sort by position number
      if (a.position !== b.position) {
        return a.position - b.position;
      }
      // 3. Then by type: Text channels come before voice channels
      if (a.type !== b.type) {
        return a.type === 'text' ? -1 : 1;
      }
      // 4. Finally by name: Alphabetical order as the final tiebreaker
      return a.name.localeCompare(b.name);
    });
  }, [communities, checkChannelAccess, parsePermissions]);

  // Get folders for a community with channels grouped by folder
  const getFolders = useCallback((communityId: string): ChannelFolder[] => {
    const allChannels = getSortedChannels(communityId);
    const folderMap = new Map<string, ChannelFolder>();

    // Group channels by folder
    allChannels.forEach(channel => {
      if (channel.folderId) {
        if (!folderMap.has(channel.folderId)) {
          folderMap.set(channel.folderId, {
            id: channel.folderId,
            name: channel.folderId, // Use folderId as name for now
            description: undefined,
            position: 0,
            communityId,
            creator: '',
            channels: [],
          });
        }
        folderMap.get(channel.folderId)!.channels.push(channel);
      }
    });

    return Array.from(folderMap.values()).sort((a, b) => a.position - b.position);
  }, [getSortedChannels]);

  // Get channels without folders, grouped by type
  const getChannelsWithoutFolder = useCallback((communityId: string): { text: DisplayChannel[]; voice: DisplayChannel[] } => {
    const allChannels = getSortedChannels(communityId);
    const channelsWithoutFolder = allChannels.filter(channel => !channel.folderId);

    return {
      text: channelsWithoutFolder.filter(channel => channel.type === 'text'),
      voice: channelsWithoutFolder.filter(channel => channel.type === 'voice'),
    };
  }, [getSortedChannels]);

  // Track whether communities initial load has completed
  const [hasCommunitiesInitialLoadCompleted, setHasCommunitiesInitialLoadCompleted] = useState(false);

  // Debounced write ref for communities cache persistence
  const debouncedCommunitiesWriteRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // Communities Cache Management Functions
  // ============================================================================

  // 1. Write communities data to cache (IndexedDB)
  const writeCommunitiesToCache = useCallback(async () => {
    if (!userPubkey) {
      logger.error('Communities: No user pubkey available for writing to cache');
      return;
    }

    logger.log(`Communities: writeCommunitiesToCache called with ${communities.size} communities`);

    // Debug: Log first few community IDs
    const communityIds = Array.from(communities.keys()).slice(0, 3);
    logger.log(`Communities: Writing communities to cache: ${communityIds.join(', ')}${communities.size > 3 ? ` and ${communities.size - 3} more` : ''}`);

    try {
      // Import the IndexedDB utilities
      const { openDB } = await import('idb');

      // Create user-specific store name (like messages do)
      const storeName = `communities-${userPubkey}`;

      // Open or create the communities database
      const db = await openDB('nostr-communities', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
            logger.log(`Communities: Created store ${storeName} in IndexedDB`);
          }
        },
      });

      // Convert Map to serializable format
      const communitiesArray = Array.from(communities.entries()).map(([id, community]) => ({
        id,
        fullAddressableId: community.fullAddressableId,
        pubkey: community.pubkey,
        info: community.info,
        definitionEvent: community.definitionEvent,
        // Convert channels Map to array for serialization
        channels: Array.from(community.channels.entries()).map(([channelId, channel]) => ({
          id: channelId,
          communityId: channel.communityId,
          info: channel.info,
          definition: channel.definition,
          // Only cache the most recent messages (messages are already sorted oldest first, so take last N)
          messages: channel.messages.slice(-CACHE_MESSAGES_LIMIT_PER_CHANNEL),
          // Convert replies Map to array for serialization
          replies: Array.from(channel.replies.entries()).map(([messageId, replies]) => ({
            messageId,
            replies,
          })),
          // Convert reactions Map to array for serialization
          reactions: Array.from(channel.reactions.entries()).map(([messageId, reactions]) => ({
            messageId,
            reactions,
          })),
          pinnedMessages: channel.pinnedMessages,
          permissions: channel.permissions,
          lastActivity: channel.lastActivity,
        })),
        approvedMembers: community.approvedMembers,
        pendingMembers: community.pendingMembers,
        membershipStatus: community.membershipStatus,
        lastActivity: community.lastActivity,
      }));

      // Create the cache object with consistent structure
      const cacheData = {
        id: 'communitiesStore', // Fixed ID for the cache object
        userPubkey,
        communities: communitiesArray,
        lastSync: Date.now(),
        version: 1,
      };

      // Write to user-specific store
      await db.put(storeName, cacheData);
      await db.close();

      // Update in-memory lastSync timestamp
      setCommunitiesLastSync(cacheData.lastSync);

      logger.log('Communities: Successfully wrote communities cache to IndexedDB');
    } catch (error) {
      logger.error('Communities: Error writing communities to IndexedDB:', error);
    }
  }, [communities, userPubkey]);

  // 2. Read communities data from cache (IndexedDB)
  const readCommunitiesFromCache = useCallback(async (): Promise<CommunitiesState | null> => {
    if (!userPubkey) {
      logger.log('Communities: No user pubkey available for reading from cache');
      return null;
    }

    logger.log('Communities: Reading communities from cache...');

    try {
      // Import the IndexedDB utilities
      const { openDB } = await import('idb');

      // Create user-specific store name (like messages do)
      const storeName = `communities-${userPubkey}`;

      // Open the communities database
      const db = await openDB('nostr-communities', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
            logger.log(`Communities: Created store ${storeName} in IndexedDB during read`);
          }
        },
      });

      // Check if the store exists before trying to read from it
      if (!db.objectStoreNames.contains(storeName)) {
        logger.log(`Communities: Store ${storeName} does not exist yet for user ${userPubkey.slice(0, 8)}...`);
        await db.close();
        return null;
      }

      // Read cached data for this user
      const cacheData = await db.get(storeName, 'communitiesStore');
      await db.close();

      if (!cacheData) {
        logger.log('Communities: No cached data found for user');
        return null;
      }

      // Check cache version and freshness
      if (cacheData.version !== 1) {
        logger.log('Communities: Cache version mismatch, ignoring cached data');
        return null;
      }

      // Check if cache is too old
      const cacheAge = Date.now() - cacheData.lastSync;
      if (cacheAge > CACHE_MAX_AGE_MS) {
        logger.log(`Communities: Cache is too old (${Math.round(cacheAge / 1000 / 60 / 60 / 24)} days), ignoring`);
        return null;
      }

      // Convert serialized data back to Map format
      // Update in-memory lastSync timestamp from cache
      setCommunitiesLastSync(cacheData.lastSync);

      const communitiesMap = new Map<string, CommunityData>();

      for (const communityData of cacheData.communities) {
        // Convert channels array back to Map
        const channelsMap = new Map<string, ChannelData>();
        for (const channelData of communityData.channels) {
          // Convert replies array back to Map
          const repliesMap = new Map<string, NostrEvent[]>();
          for (const replyData of channelData.replies) {
            repliesMap.set(replyData.messageId, replyData.replies);
          }

          // Convert reactions array back to Map
          const reactionsMap = new Map<string, NostrEvent[]>();
          for (const reactionData of channelData.reactions) {
            reactionsMap.set(reactionData.messageId, reactionData.reactions);
          }

          // Handle corrupted cache data - extract simple channel ID if needed
          const cleanChannelId = (() => {
            if (channelData.id.includes(':')) {
              const parts = channelData.id.split(':');
              return parts[parts.length - 1]; // Extract simple name from corrupted cache
            }
            return channelData.id; // Already clean
          })();

          channelsMap.set(cleanChannelId, {
            id: cleanChannelId, // Clean channel ID
            communityId: channelData.communityId,
            info: channelData.info,
            definition: channelData.definition,
            messages: channelData.messages,
            replies: repliesMap,
            reactions: reactionsMap,
            pinnedMessages: channelData.pinnedMessages || [],
            permissions: channelData.permissions,
            lastActivity: channelData.lastActivity,
            // Initialize pagination state for cached data
            hasMoreMessages: true,
            isLoadingOlderMessages: false,
            reachedStartOfConversation: false,
          });
        }

        communitiesMap.set(communityData.id, {
          id: communityData.id,
          fullAddressableId: communityData.fullAddressableId,
          pubkey: communityData.pubkey,
          info: communityData.info,
          definitionEvent: communityData.definitionEvent,
          channels: channelsMap,
          approvedMembers: communityData.approvedMembers,
          pendingMembers: communityData.pendingMembers,
          declinedMembers: communityData.declinedMembers || null,
          bannedMembers: communityData.bannedMembers || null,
          membershipStatus: communityData.membershipStatus,
          lastActivity: communityData.lastActivity,
          isLoadingChannels: false, // Always false when loading from cache
        });
      }

      // Debug: Log first few community IDs from cache
      const cachedCommunityIds = Array.from(communitiesMap.keys()).slice(0, 3);
      logger.log(`Communities: Successfully read ${communitiesMap.size} communities from cache (age: ${Math.round(cacheAge / 1000)}s): ${cachedCommunityIds.join(', ')}${communitiesMap.size > 3 ? ` and ${communitiesMap.size - 3} more` : ''}`);
      return communitiesMap;
    } catch (error) {
      logger.error('Communities: Error reading communities from IndexedDB:', error);
      return null;
    }
  }, [userPubkey]);

  // 3. Debounced write to cache (similar to messages debouncing)
  const triggerDebouncedCommunitiesWrite = useCallback(() => {
    if (debouncedCommunitiesWriteRef.current) {
      clearTimeout(debouncedCommunitiesWriteRef.current);
    }
    debouncedCommunitiesWriteRef.current = setTimeout(() => {
      writeCommunitiesToCache();
      debouncedCommunitiesWriteRef.current = null;
    }, DATA_MANAGER_CONSTANTS.DEBOUNCED_WRITE_DELAY); // Reuse same 15s delay
  }, [writeCommunitiesToCache]);

  // Start communities loading when user is available
  useEffect(() => {
    if (!userPubkey) {
      logger.log('Communities: No user pubkey available, skipping communities loading');
      return;
    }

    if (hasCommunitiesInitialLoadCompleted) {
      logger.log('Communities: Initial load already completed, skipping duplicate request');
      return;
    }

    if (communitiesLoading) {
      logger.log('Communities: Communities loading already in progress');
      return;
    }

    logger.log('Communities: Starting communities loading for user');

    // Try to load from cache first, then fall back to network
    const loadCommunitiesWithCache = async () => {
      try {
        const cachedCommunities = await readCommunitiesFromCache();

        if (cachedCommunities && cachedCommunities.size > 0) {
          logger.log(`Communities: Loaded ${cachedCommunities.size} communities from cache, starting background refresh`);

          // Set cached data immediately for fast UI
          setCommunities(cachedCommunities);
          setHasCommunitiesInitialLoadCompleted(true);
          setCommunitiesLoadingPhase(LOADING_PHASES.READY);

          // Cache loaded successfully - start subscriptions
          logger.log('Communities: Cache loaded successfully, starting subscriptions');
          logger.log(`[CHANNEL-DEBUG] Starting subscriptions with ${cachedCommunities.size} communities loaded`);
          startCommunityMessagesSubscription(cachedCommunities);
          startCommunityManagementSubscription();
        } else {
          logger.log('Communities: No valid cache found, loading from network');
          startCommunitiesLoading();
        }
      } catch (error) {
        logger.error('Communities: Error loading from cache, falling back to network:', error);
        startCommunitiesLoading();
      }
    };

    loadCommunitiesWithCache();
  }, [userPubkey, hasCommunitiesInitialLoadCompleted, communitiesLoading, startCommunitiesLoading, readCommunitiesFromCache, startCommunityMessagesSubscription, startCommunityManagementSubscription]);


  // Cleanup subscriptions when component unmounts or user changes
  useEffect(() => {
    return () => {
      // Close all subscriptions on cleanup
      if (nip4SubscriptionRef.current) {
        nip4SubscriptionRef.current.close();
        logger.log('DMS: DataManager: Cleaned up NIP-4 subscription');
      }
      if (nip17SubscriptionRef.current) {
        nip17SubscriptionRef.current.close();
        logger.log('DMS: DataManager: Cleaned up NIP-17 subscription');
      }
      if (communityMessagesSubscriptionRef.current) {
        communityMessagesSubscriptionRef.current.close();
        logger.log('Communities: DataManager: Cleaned up community messages subscription');
      }
      if (communityManagementSubscriptionRef.current) {
        communityManagementSubscriptionRef.current.close();
        logger.log('Communities: DataManager: Cleaned up community management subscription');
      }

      // Clear debounced write timeout
      if (debouncedWriteRef.current) {
        clearTimeout(debouncedWriteRef.current);
        logger.log('DMS: DataManager: Cleaned up debounced write timeout');
      }

      // Clear debounced communities write timeout
      if (debouncedCommunitiesWriteRef.current) {
        clearTimeout(debouncedCommunitiesWriteRef.current);
        logger.log('Communities: DataManager: Cleaned up debounced communities write timeout');
      }

      // Reset subscription status
      setSubscriptions({ nip4: false, nip17: false });
    };
  }, []);

  // Memoized conversation summary - now much simpler since messages are already organized by participant
  const conversations = useMemo(() => {
    const conversationsList: ConversationSummary[] = [];

    messages.forEach((participant, participantPubkey) => {
      if (!participant.messages.length) return;

      // Analyze messages to determine if user has sent any messages to this participant
      const userHasSentMessage = participant.messages.some(msg => msg.pubkey === user?.pubkey);
      const isKnown = userHasSentMessage; // User has sent at least one message
      const isRequest = !userHasSentMessage; // User hasn't sent any messages (only received)

      // Get the most recent message to determine who sent it
      const lastMessage = participant.messages[participant.messages.length - 1]; // Last in chronological order
      const isFromUser = lastMessage.pubkey === user?.pubkey;

      conversationsList.push({
        id: participantPubkey,
        pubkey: participantPubkey,
        lastMessage: participant.lastMessage,
        lastActivity: participant.lastActivity,
        hasNIP4Messages: participant.hasNIP4,
        hasNIP17Messages: participant.hasNIP17,
        isKnown: isKnown,
        isRequest: isRequest,
        lastMessageFromUser: isFromUser,
      });
    });

    return conversationsList.sort((a, b) => b.lastActivity - a.lastActivity);
  }, [messages, user?.pubkey]);

  const getDebugInfo = useCallback(() => {
    // Count total messages from all participants
    let totalMessageCount = 0;
    let nip4Count = 0;
    let nip17Count = 0;

    messages.forEach((participant) => {
      totalMessageCount += participant.messages.length;
      if (participant.hasNIP4) {
        const nip4Messages = participant.messages.filter((msg: DecryptedMessage) => msg.kind === 4);
        nip4Count += nip4Messages.length;
      }
      if (participant.hasNIP17) {
        const nip17Messages = participant.messages.filter((msg: DecryptedMessage) => msg.kind === 1059 || msg.kind === 14);
        nip17Count += nip17Messages.length;
      }
    });

    return {
      messageCount: totalMessageCount,
      nip4Count,
      nip17Count,
      nip4Sync: lastSync.nip4 ? new Date(lastSync.nip4 * 1000) : null,
      nip17Sync: lastSync.nip17 ? new Date(lastSync.nip17 * 1000) : null,
      nip17Enabled: settings.enableNIP17,
    };
  }, [messages, lastSync.nip4, lastSync.nip17, settings.enableNIP17]);

  // Debug method to write all current messages to IndexedDB
  const writeAllMessagesToStore = useCallback(async () => {
    if (!userPubkey) {
      logger.error('DMS: DataManager: No user pubkey available for writing to store');
      return;
    }

    logger.log(`DMS: DataManager: writeAllMessagesToStore called with ${messages.size} participants`);

    try {
      const { writeMessagesToDB } = await import('@/lib/messageStore');

      // Convert current messages state to MessageStore format
      // Store the ORIGINAL encrypted messages, not decrypted content
      const messageStore = {
        participants: {} as Record<string, {
          messages: {
            id: string;
            pubkey: string;
            content: string; // This will be the ORIGINAL encrypted content
            created_at: number;
            kind: number;
            tags: string[][];
            sig: string;
            isOriginallyEncrypted?: boolean; // Flag to indicate if this was decrypted
            originalEncryptedContent?: string; // Store original encrypted content
          }[];
          lastActivity: number;
          hasNIP4: boolean;
          hasNIP17: boolean;
        }>,
        lastSync: {
          nip4: lastSync.nip4,
          nip17: lastSync.nip17,
        }
      };

      messages.forEach((participant, participantPubkey) => {
        messageStore.participants[participantPubkey] = {
          messages: participant.messages.map(msg => {
            // SECURITY: Store only the original encrypted content, not decrypted
            // Drop decryptedContent and error when saving to IndexedDB

            return {
              id: msg.id,
              pubkey: msg.pubkey,
              content: msg.content, // Keep original encrypted content
              created_at: msg.created_at,
              kind: msg.kind,
              tags: msg.tags,
              sig: msg.sig,
              // Drop decryptedContent and error when saving to IndexedDB
            } as NostrEvent;
          }),
          lastActivity: participant.lastActivity,
          hasNIP4: participant.hasNIP4,
          hasNIP17: participant.hasNIP17,
        };
      });

      logger.log(`DMS: DataManager: About to write ${Object.keys(messageStore.participants).length} participants to IndexedDB`);
      await writeMessagesToDB(userPubkey, messageStore);
      logger.log(`DMS: DataManager: writeMessagesToDB completed successfully`);

      // Update lastSync timestamps to current time after successful save
      const currentTime = Math.floor(Date.now() / 1000); // Convert to Unix timestamp
      setLastSync(prev => ({
        nip4: prev.nip4 || currentTime, // Keep existing if set, otherwise use current time
        nip17: prev.nip17 || currentTime
      }));

      logger.log(`DMS: DataManager: Successfully wrote message store to IndexedDB with ${Object.keys(messageStore.participants).length} participants. Updated lastSync timestamps.`);
    } catch (error) {
      logger.error('DMS: DataManager: Error writing messages to IndexedDB:', error);
    }
  }, [messages, userPubkey, lastSync]);


  // Trigger debounced write to IndexedDB
  const triggerDebouncedWrite = useCallback(() => {
    if (debouncedWriteRef.current) {
      clearTimeout(debouncedWriteRef.current);
    }
    debouncedWriteRef.current = setTimeout(() => {
      writeAllMessagesToStore();
      debouncedWriteRef.current = null;
    }, DATA_MANAGER_CONSTANTS.DEBOUNCED_WRITE_DELAY);
  }, [writeAllMessagesToStore]);

  // Watch messages state and handle debounced saves
  useEffect(() => {
    if (messages.size === 0) return; // Don't save empty state

    if (shouldSaveImmediately) {
      // Clear the flag and save immediately
      setShouldSaveImmediately(false);
      logger.log('DMS: DataManager: Triggering immediate save after relay message processing');
      writeAllMessagesToStore();
    } else {
      // Normal debounced save for real-time messages
      triggerDebouncedWrite();
    }
  }, [messages, shouldSaveImmediately, writeAllMessagesToStore, triggerDebouncedWrite]);

  // Watch communities state and handle cache writes (like messages pattern)
  useEffect(() => {
    if (communities.size === 0) return; // Don't save empty state

    if (shouldSaveCommunitiesImmediately) {
      // Clear the flag and save immediately
      setShouldSaveCommunitiesImmediately(false);
      logger.log('Communities: Triggering immediate save after network loading');
      writeCommunitiesToCache();
    } else {
      // Normal debounced save for real-time updates
      triggerDebouncedCommunitiesWrite();
    }
  }, [communities, shouldSaveCommunitiesImmediately, writeCommunitiesToCache, triggerDebouncedCommunitiesWrite]);



  // Debug method to reset all message data and cache for current user
  const resetMessageDataAndCache = useCallback(async () => {
    if (!userPubkey) {
      logger.error('DMS: DataManager: No user pubkey available for resetting data');
      return;
    }

    try {
      const { clearMessagesFromDB } = await import('@/lib/messageStore');
      await clearMessagesFromDB(userPubkey);

      // Clear local state
      setMessages(new Map());
      setLastSync({ nip4: null, nip17: null });
      setHasInitialLoadCompleted(false);

      logger.log('DMS: DataManager: Successfully reset message data and cache');
    } catch (error) {
      logger.error('DMS: DataManager: Error resetting message data and cache:', error);
    }
  }, [userPubkey]);

  // Derived state for cleaner loading logic
  const isDoingInitialLoad = isLoading && (loadingPhase === LOADING_PHASES.CACHE || loadingPhase === LOADING_PHASES.RELAYS);

  // Send message function with optimistic updates
  const sendMessage = useCallback(async (params: { recipientPubkey: string; content: string; protocol?: MessageProtocol }) => {
    const { recipientPubkey, content, protocol = MESSAGE_PROTOCOL.NIP04 } = params;
    if (!userPubkey) {
      logger.error('DMS: DataManager: Cannot send message, no user pubkey');
      return;
    }

    logger.log(`DMS: DataManager: Sending ${protocol} message to ${recipientPubkey}`);

    // Create optimistic message with consistent structure
    const optimisticId = `optimistic-${Date.now()}-${Math.random()}`;
    const optimisticMessage: DecryptedMessage = {
      id: optimisticId, // Temporary ID for optimistic message
      kind: protocol === MESSAGE_PROTOCOL.NIP04 ? 4 : 1059, // NIP-4 DM or NIP-17 Gift Wrap for display
      pubkey: userPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', recipientPubkey]],
      content: '', // Empty encrypted content (will be filled when real message arrives)
      decryptedContent: content, // Plain text content for display
      sig: '',
      isSending: true, // Mark as optimistic
      clientFirstSeen: Date.now(), // Mark as just created for animation
    };

    // Add to messages state using reusable method
    addMessageToState(optimisticMessage, recipientPubkey, protocol === MESSAGE_PROTOCOL.NIP04 ? MESSAGE_PROTOCOL.NIP04 : MESSAGE_PROTOCOL.NIP17);

    try {
      // Use the existing working send functions
      if (protocol === MESSAGE_PROTOCOL.NIP04) {
        await sendNIP4Message.mutateAsync({
          recipientPubkey,
          content,
        });
      } else if (protocol === MESSAGE_PROTOCOL.NIP17) {
        await sendNIP17Message.mutateAsync({
          recipientPubkey,
          content,
        });
      }

      logger.log(`DMS: DataManager: Successfully sent ${protocol} message to ${recipientPubkey}`);
    } catch (error) {
      logger.error(`DMS: DataManager: Failed to send ${protocol} message to ${recipientPubkey}:`, error);
    }
  }, [userPubkey, addMessageToState, sendNIP4Message, sendNIP17Message]);

  // Organize messaging functionality into its own domain
  const messaging: MessagingDomain = {
    messages,
    isLoading,
    loadingPhase,
    isDoingInitialLoad,
    lastSync,
    conversations,
    getDebugInfo,
    writeAllMessagesToStore,
    resetMessageDataAndCache,
    handleNIP17SettingChange,
    sendMessage,
    isNIP17Enabled: settings.enableNIP17,
    isDebugging: true, // Hardcoded for now
    scanProgress,
    subscriptions,
  };

  // Load older messages for a channel - simplified approach matching useMessages.ts
  const loadOlderMessages = useCallback(async (communityId: string, channelId: string) => {
    const community = communities.get(communityId);
    if (!community) return;

    const channel = community.channels.get(channelId);
    if (!channel || !channel.hasMoreMessages || channel.isLoadingOlderMessages || !channel.oldestMessageTimestamp) {
      return;
    }

    // Set loading state
    setCommunities(prev => {
      const newCommunities = new Map(prev);
      const updatedCommunity = { ...newCommunities.get(communityId)! };
      const updatedChannels = new Map(updatedCommunity.channels);
      const updatedChannel = { ...updatedChannels.get(channelId)! };
      updatedChannel.isLoadingOlderMessages = true;
      updatedChannels.set(channelId, updatedChannel);
      updatedCommunity.channels = updatedChannels;
      newCommunities.set(communityId, updatedCommunity);
      return newCommunities;
    });

    try {
      // Build community reference and query for older messages
      const communityRef = `34550:${community.pubkey}:${community.id}`;
      const olderMessages = await nostr.query([{
        kinds: [9411],
        '#a': [communityRef],
        '#t': [channelId],
        until: channel.oldestMessageTimestamp - 1, // -1 to avoid getting the same message again
        limit: MESSAGES_PER_PAGE,
      }], { signal: AbortSignal.timeout(10000) });

      // Load reactions for the older messages
      let olderReactions: NostrEvent[] = [];
      if (olderMessages.length > 0) {
        const olderMessageIds = olderMessages.map(msg => msg.id);
        olderReactions = await nostr.query([{
          kinds: [7, 9735], // Reaction events and Zap receipts
          '#e': olderMessageIds, // Reactions/zaps to older messages
          // No limit - get all reactions/zaps to older messages
        }], { signal: AbortSignal.timeout(10000) });
      }

      // Update channel with new messages
      setCommunities(prev => {
        const newCommunities = new Map(prev);
        const updatedCommunity = { ...newCommunities.get(communityId)! };
        const updatedChannels = new Map(updatedCommunity.channels);
        const updatedChannel = { ...updatedChannels.get(channelId)! };

        // Sort new messages and merge with existing
        const sortedNewMessages = olderMessages.sort((a, b) => a.created_at - b.created_at);
        const allMessages = [...sortedNewMessages, ...updatedChannel.messages];

        // Add reactions for older messages
        const updatedReactions = new Map(updatedChannel.reactions);
        olderReactions.forEach(reaction => {
          const eTags = reaction.tags.filter(([name]) => name === 'e');
          eTags.forEach(([, messageId]) => {
            if (!updatedReactions.has(messageId)) {
              updatedReactions.set(messageId, []);
            }
            updatedReactions.get(messageId)!.push(reaction);
          });
        });

        // Sort reactions by timestamp for each message
        updatedReactions.forEach(reactions => {
          reactions.sort((a, b) => a.created_at - b.created_at);
        });

        updatedChannel.messages = allMessages;
        updatedChannel.reactions = updatedReactions;
        updatedChannel.oldestMessageTimestamp = allMessages.length > 0 ? allMessages[0].created_at : undefined;
        updatedChannel.hasMoreMessages = olderMessages.length >= MESSAGES_PER_PAGE; // More if we got a full page
        updatedChannel.reachedStartOfConversation = olderMessages.length < MESSAGES_PER_PAGE; // Reached start if less than full page
        updatedChannel.isLoadingOlderMessages = false;

        updatedChannels.set(channelId, updatedChannel);
        updatedCommunity.channels = updatedChannels;
        newCommunities.set(communityId, updatedCommunity);
        return newCommunities;
      });
    } catch (error) {
      console.error('Failed to load older messages:', error);
      // Reset loading state on error
      setCommunities(prev => {
        const newCommunities = new Map(prev);
        const updatedCommunity = { ...newCommunities.get(communityId)! };
        const updatedChannels = new Map(updatedCommunity.channels);
        const updatedChannel = { ...updatedChannels.get(channelId)! };
        updatedChannel.isLoadingOlderMessages = false;
        updatedChannels.set(channelId, updatedChannel);
        updatedCommunity.channels = updatedChannels;
        newCommunities.set(communityId, updatedCommunity);
        return newCommunities;
      });
    }
  }, [communities, nostr]);

  // Reset communities data and cache
  const resetCommunitiesDataAndCache = useCallback(async () => {
    try {
      logger.log('Communities: Resetting communities data and cache...');

      // Clear in-memory state
      setCommunities(new Map());
      setCommunitiesLoading(false);
      setCommunitiesLoadingPhase(LOADING_PHASES.IDLE);
      setCommunitiesLoadTime(null);
      setCommunitiesLoadBreakdown(null);
      setHasCommunitiesInitialLoadCompleted(false);
      setCommunitiesLastSync(null);

      // Clear IndexedDB cache
      const dbName = 'nostr-communities';
      const deleteRequest = indexedDB.deleteDatabase(dbName);

      return new Promise<void>((resolve, reject) => {
        deleteRequest.onsuccess = () => {
          logger.log('Communities: Database cache cleared successfully');
          resolve();
        };

        deleteRequest.onerror = () => {
          logger.error('Communities: Failed to clear database cache');
          reject(new Error('Failed to clear database cache'));
        };
      });
    } catch (error) {
      logger.error('Communities: Error resetting data and cache:', error);
      throw error;
    }
  }, []);

  // Hook to get pinned messages for a specific channel
  const useDataManagerPinnedMessages = useCallback((communityId: string | null, channelId: string | null): NostrEvent[] => {
    if (!communityId || !channelId) {
      return [];
    }

    const simpleCommunityId = (() => {
      if (communityId.includes(':')) {
        const parts = communityId.split(':');
        return parts[2] || parts[parts.length - 1];
      }
      return communityId;
    })();

    const community = communities.get(simpleCommunityId);
    if (!community) {
      return [];
    }

    const channelData = community.channels.get(channelId);
    if (!channelData) {
      return [];
    }

    return channelData.pinnedMessages;
  }, [communities]);

  // Organize communities functionality into its own domain
  const communitiesDomain: CommunitiesDomain = {
    communities,
    isLoading: communitiesLoading,
    loadingPhase: communitiesLoadingPhase,
    loadTime: communitiesLoadTime,
    loadBreakdown: communitiesLoadBreakdown,
    getDebugInfo: getCommunitiesDebugInfo,
    getSortedChannels,
    getFolders,
    getChannelsWithoutFolder,
    addOptimisticMessage: addOptimisticCommunityMessage,
    addOptimisticChannel,
    deleteChannelImmediately,
    loadOlderMessages,
    resetCommunitiesDataAndCache,
    useDataManagerPinnedMessages,
    approveMember,
    declineMember,
    banMember,
  };

  const contextValue: DataManagerContextType = {
    messaging,
    communities: communitiesDomain,
  };

  return (
    <DataManagerContext.Provider value={contextValue}>
      {children}
    </DataManagerContext.Provider>
  );
}
