import {
  HelpCircle,
  Hash,
  Users,
  Search,
  Volume2,
  Settings,
  Copy,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { VoiceChannel } from "@/components/voice/VoiceChannel";
import { generateSpaceUrl } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useJoinRequests } from "@/hooks/useJoinRequests";
import { Badge } from "@/components/ui/badge";
import { useDataManagerCommunityChannel, DisplayChannel, useDataManagerUserRole, useDataManagerCanModerate, useDataManagerUserMembership, useDataManager, useDataManagerPinnedMessages } from "@/components/DataManagerProvider";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { usePinMessage, useUnpinMessage } from "@/hooks/usePinnedMessages";
import { useModerationActions } from "@/hooks/useModerationActions";
import { useMentionNotifications } from "@/hooks/useMentionNotifications";
import { useDeleteMessage } from "@/hooks/useMessageActions";
import type { NostrEvent } from "@nostrify/nostrify";
import { useState, useMemo, useCallback } from "react";
import { ChannelSettingsDialog } from "@/components/community/ChannelSettingsDialog";
import { CommunitySettings } from "@/components/community/CommunitySettings";
import { useToast } from '@/hooks/useToast';
import { MessageThread } from "@/components/chat/MessageThread";
import { JoinRequestDialog } from "@/components/community/JoinRequestDialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { BaseChatArea } from "@/components/messaging/BaseChatArea";
import {
  groupMessageInputConfig,
  groupMessageItemConfig,
  groupMessageListConfig,
} from "@/components/messaging/configs/groupConfig";

// Component for when a channel is not found
function ChannelNotFound({ channelId }: { channelId: string }) {
  return (
    <div className="flex flex-col h-full w-full max-w-full overflow-hidden bg-white dark:bg-gray-900">
      <div className="h-14 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 bg-white dark:bg-gray-900 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-full border border-red-200 dark:border-red-800">
            <Hash className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <span className="font-semibold text-gray-900 dark:text-gray-100">#{channelId}</span>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-600 dark:text-gray-400">
          <div className="p-4 bg-red-100 dark:bg-red-900/20 rounded-full border border-red-200 dark:border-red-800 inline-block mb-6">
            <Hash className="w-16 h-16 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">Channel not found</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            The channel <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">#{channelId}</span> doesn't exist or you don't have access to it.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Try selecting a different channel from the sidebar.
          </p>
        </div>
      </div>
    </div>
  );
}


interface ChatAreaProps {
  communityId: string | null;
  channelId: string | null;
  onToggleMemberList: () => void;
  onNavigateToDMs?: (targetPubkey: string) => void;
}

function CommunityChatHeader({
  communityId,
  channelId,
  onToggleMemberList,
  channel
}: {
  communityId: string;
  channelId: string;
  onToggleMemberList: () => void;
  channel: DisplayChannel | null;
}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { canModerate } = useDataManagerCanModerate(communityId);
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [showModerationPanel, setShowModerationPanel] = useState(false);
  const { data: joinRequests } = useJoinRequests(communityId);
  const pendingJoinRequests = joinRequests?.length || 0;
  const { communities } = useDataManager();

  if (!channel) {
    return null;
  }

  const channelName = channel.name || channelId;
  const isVoiceChannel = channel.type === "voice";

  const copyChannelLink = () => {
    // Get the full addressable ID from DataManager
    const community = communities.communities.get(communityId);
    
    if (!community) {
      toast({
        title: 'Copy Failed',
        description: 'Community not found.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Use the full addressable ID for proper naddr encoding
      const channelLink = generateSpaceUrl(community.fullAddressableId, channelId);
      navigator.clipboard.writeText(channelLink);
      toast({
        title: 'Link Copied',
        description: 'Channel link copied to clipboard.',
      });
    } catch {
      toast({
        title: 'Copy Failed',
        description: 'Failed to generate channel link. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (isMobile) {
    return null; // Mobile header handled separately
  }

  return (
    <>
      <div className="h-14 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-full border border-purple-200 dark:border-purple-800">
            {isVoiceChannel
              ? <Volume2 className="w-4 h-4 text-green-500" />
              : <Hash className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
          </div>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{channelName}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-purple-100 dark:hover:bg-purple-900/20 rounded-full"
            onClick={() => navigate("/search")}
          >
            <Search className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-purple-100 dark:hover:bg-purple-900/20 rounded-full"
            onClick={onToggleMemberList}
          >
            <Users className="w-4 h-4" />
          </Button>
          {canModerate && channel
            ? (
              <>
                {/* Moderation Button with Notification Badge */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowModerationPanel(true)}
                  className="relative w-8 h-8 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-purple-100 dark:hover:bg-purple-900/20 rounded-full"
                >
                  <Shield className="w-4 h-4" />
                  {pendingJoinRequests > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center rounded-full"
                    >
                      {pendingJoinRequests}
                    </Badge>
                  )}
                </Button>

                {/* Channel Settings Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-purple-100 dark:hover:bg-purple-900/20 rounded-full">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-800 backdrop-blur-sm rounded-xl shadow-sm">
                    <DropdownMenuItem
                      onClick={() => setShowChannelSettings(true)}
                      className="text-gray-900 dark:text-gray-100 hover:bg-purple-100 dark:hover:bg-purple-900/20 focus:bg-purple-100 dark:hover:bg-purple-900/20 rounded-lg cursor-pointer"
                    >
                      <Settings className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400" />
                      Edit Channel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={copyChannelLink} className="text-gray-900 dark:text-gray-100 hover:bg-purple-100 dark:hover:bg-purple-900/20 focus:bg-purple-100 dark:hover:bg-purple-900/20 rounded-lg cursor-pointer">
                      <Copy className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400" />
                      Copy Channel Link
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )
            : (
              <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-purple-100 dark:hover:bg-purple-900/20 rounded-full">
                <HelpCircle className="w-4 h-4" />
              </Button>
            )}
        </div>
      </div>

      {channel && (
        <ChannelSettingsDialog
          channel={channel}
          communityId={communityId}
          open={showChannelSettings}
          onOpenChange={setShowChannelSettings}
        />
      )}

      {/* Moderation Panel */}
      {showModerationPanel && (
        <CommunitySettings
          communityId={communityId}
          open={showModerationPanel}
          onOpenChange={setShowModerationPanel}
        />
      )}
    </>
  );
}

function CommunityChat(
  { communityId, channelId, onToggleMemberList, onNavigateToDMs }:
    & Omit<ChatAreaProps, "communityId" | "channelId">
    & { communityId: string; channelId: string },
) {
  // Use our enhanced hook that provides a channel with all its data including messages
  const {
    isLoading,
    channel
  } = useDataManagerCommunityChannel(communityId, channelId);

  // Get messages from the channel object
  const messages = channel?.messages || [];

  // Get pagination state from DataManager
  const { communities } = useDataManager();
  const community = communities.communities.get(communityId);
  const channelData = community?.channels.get(channelId);

  const hasMoreMessages = channelData?.hasMoreMessages ?? false;
  const loadingOlderMessages = channelData?.isLoadingOlderMessages ?? false;
  const reachedStartOfConversation = channelData?.reachedStartOfConversation ?? true;

  const loadOlderMessages = useCallback(async () => {
    await communities.loadOlderMessages(communityId, channelId);
  }, [communities, communityId, channelId]);
  const { mutateAsync: createEvent } = useNostrPublish();
  const { mutate: pinMessage } = usePinMessage();
  const { mutate: unpinMessage } = useUnpinMessage();
  // Get pinned messages from DataManager (full events, not just IDs)
  const pinnedMessages = useDataManagerPinnedMessages(communityId, channelId);
  // Derive message IDs from the full events for pin status checking
  const pinnedMessageIds = useMemo(() => pinnedMessages.map(msg => msg.id), [pinnedMessages]);
  const { role } = useDataManagerUserRole(communityId);
  const { banUser } = useModerationActions();
  const { mutate: deleteMessage } = useDeleteMessage(communityId);
  const { mutate: sendMentionNotifications } = useMentionNotifications();
  const { data: membershipStatus } = useDataManagerUserMembership(communityId);
  const [threadRootMessage, setThreadRootMessage] = useState<NostrEvent | null>(null);
  const [isThreadOpen, setIsThreadOpen] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  const isAdmin = role === 'owner' || role === 'moderator';

  // Create dynamic message item config based on user role
  const dynamicMessageItemConfig = useMemo(() => ({
    ...groupMessageItemConfig,
    showBan: isAdmin, // Enable ban option for admin users
  }), [isAdmin]);

  // Memoize query key to prevent unnecessary re-renders
  const queryKey = useMemo(() => ['messages', communityId, channelId], [communityId, channelId]);

  const handleSendMessage = useCallback(async (content: string, additionalTags: string[][] = []) => {
    // Get the full addressable ID from DataManager
    const community = communities.communities.get(communityId);
    if (!community) {
      console.error('Community not found for sending message:', communityId);
      return;
    }

    // Add optimistic message immediately for UI feedback
    const optimisticMessage = communities.addOptimisticMessage(communityId, channelId, content, additionalTags);
    if (!optimisticMessage) {
      console.error('Failed to add optimistic message');
      return;
    }

    try {
      // Build proper addressable references to match query format
      const communityRef = `34550:${community.pubkey}:${community.id}`; // "34550:pubkey:communitySlug"
      const channelRef = `${communityRef}:${channelId}`; // "34550:pubkey:communitySlug:channelSlug"

      const tags = [
        ["t", channelRef], // Full addressable channel reference
        ["a", communityRef], // Full addressable community reference
        ...additionalTags, // Add any additional tags (like imeta for files, p tags for mentions)
      ];

      // Extract mentioned pubkeys from p tags
      const mentionedPubkeys = tags
        .filter(([name]) => name === 'p')
        .map(([, pubkey]) => pubkey);

      const messageEvent = await createEvent({
        kind: 9411,
        content,
        tags,
      });

      // Send mention notifications if there are any mentioned users
      if (mentionedPubkeys.length > 0 && messageEvent) {
        try {
          await sendMentionNotifications({
            mentionedPubkeys,
            messageEvent,
            communityId,
            channelId,
          });
        } catch (error) {
          console.error('Failed to send mention notifications:', error);
          // Don't fail the message send if notifications fail
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // TODO: add error handling to remove optimistic message or mark it as failed
    }
  }, [communityId, channelId, createEvent, sendMentionNotifications, communities]);

  const handlePinMessage = useCallback((message: NostrEvent) => {
    const isPinned = pinnedMessageIds?.includes(message.id) || false;

    if (isPinned) {
      unpinMessage({ communityId, channelId, messageId: message.id });
    } else {
      pinMessage({ communityId, channelId, messageId: message.id });
    }
  }, [pinnedMessageIds, unpinMessage, pinMessage, communityId, channelId]);

  const handleReply = useCallback((message: NostrEvent) => {
    setThreadRootMessage(message);
    setIsThreadOpen(true);
  }, []);

  const handleBanUser = useCallback((pubkey: string, reason?: string) => {
    banUser.mutate({
      communityId,
      userPubkey: pubkey,
      reason: reason?.trim() || 'Banned by admin from chat'
    });
  }, [banUser, communityId]);

  const handleDeleteMessage = useCallback((message: NostrEvent, reason?: string) => {
    deleteMessage({
      messageEvent: message,
      reason: reason?.trim()
    });
  }, [deleteMessage]);

  // Memoize JSX elements after all hooks
  const header = useMemo(() => (
    <CommunityChatHeader
      communityId={communityId}
      channelId={channelId}
      onToggleMemberList={onToggleMemberList}
      channel={channel}
    />
  ), [communityId, channelId, onToggleMemberList, channel]);

  const additionalContent = useMemo(() => (
    <div className="flex-shrink-0">
      <TypingIndicator channelId={channelId} />
    </div>
  ), [channelId]);

  // Now we can do early returns and computed values
  const channelName = channel?.name || channelId;
  const isVoiceChannel = channel?.type === "voice";

  // Memoize input placeholder to prevent re-renders (must be after channelName is defined)
  const inputPlaceholder = useMemo(() => `Message #${channelName}`, [channelName]);

  // Show loading state while channel is loading
  if (isLoading) {
    return (
      <div className="flex flex-col h-full w-full max-w-full overflow-hidden bg-white dark:bg-gray-900">
        <div className="h-14 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 bg-white dark:bg-gray-900 backdrop-blur-sm">
          <div className="flex items-center space-x-3">
            <Skeleton className="w-6 h-6 rounded" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="w-8 h-8 rounded" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-5/6" />
            <Skeleton className="h-12 w-4/5" />
          </div>
        </div>
      </div>
    );
  }

  // Show channel not found only after loading is complete
  if (!channel) {
    return <ChannelNotFound channelId={channelId} />;
  }

  const handleJoinRequest = () => {
    setShowJoinDialog(true);
  };

  if (isVoiceChannel) {
    return (
      <div className="flex flex-col h-full chat-container">
        {header}
        <div className="flex-1 p-4">
          <VoiceChannel channelId={channelId} channelName={channelName} />
        </div>
      </div>
    );
  }

  return (
    <>
      <BaseChatArea
        messages={messages || []}
        pinnedMessages={pinnedMessages}
        isLoading={isLoading}
        onSendMessage={handleSendMessage}
        queryKey={queryKey}
        onPin={handlePinMessage}
        onReply={handleReply}
        onBan={handleBanUser}
        onDelete={handleDeleteMessage}
        header={header}
        messageListConfig={groupMessageListConfig}
        messageItemConfig={dynamicMessageItemConfig}
        messageInputConfig={groupMessageInputConfig}
        inputPlaceholder={inputPlaceholder}
        onNavigateToDMs={onNavigateToDMs}
        communityId={communityId}
        channelId={channelId}
        additionalContent={additionalContent}
        hasMoreMessages={hasMoreMessages}
        loadingOlderMessages={loadingOlderMessages}
        onLoadOlderMessages={loadOlderMessages}
        reachedStartOfConversation={reachedStartOfConversation}
        membershipStatus={membershipStatus}
        onJoinRequest={handleJoinRequest}
      />

      {threadRootMessage && (
        (() => {
          // Debug: Log communityId right before rendering MessageThread
          if (process.env.NODE_ENV === 'development') {
            console.log('About to render MessageThread with communityId:', communityId);
          }
          return null;
        })()
      )}
      {threadRootMessage && (
        <MessageThread
          rootMessage={threadRootMessage}
          open={isThreadOpen}
          onOpenChange={setIsThreadOpen}
          onNavigateToDMs={onNavigateToDMs}
          communityId={communityId}
          channelId={channelId}
        />
      )}

      {showJoinDialog && (
        <JoinRequestDialog
          communityId={communityId}
          open={showJoinDialog}
          onOpenChange={setShowJoinDialog}
        />
      )}
    </>
  );
}

export function ChatArea(props: ChatAreaProps) {

  if (!props.communityId || !props.channelId) {
    return (
      <div className="flex flex-col h-full w-full max-w-full overflow-hidden bg-white dark:bg-gray-900">
        <div className="h-14 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 bg-white dark:bg-gray-900 backdrop-blur-sm">
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 bg-blue-600/20 rounded-full animate-pulse" />
            <div className="w-24 h-5 bg-blue-600/20 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-600 dark:text-gray-400">
            <div className="p-4 bg-purple-100 dark:bg-purple-900/20 rounded-full border border-purple-200 dark:border-purple-800 inline-block mb-6">
              <Hash className="w-16 h-16 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">Select a channel</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Choose a channel to start chatting!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CommunityChat
      {...props}
      communityId={props.communityId}
      channelId={props.channelId}
    />
  );
}
