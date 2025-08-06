import { useMemo, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { MessageItem } from "./MessageItem";
import { PinnedMessages } from "./PinnedMessages";
import { useMessages } from "@/hooks/useMessages";
import { usePinnedMessages } from "@/hooks/usePinnedMessages";
import { useChannels } from "@/hooks/useChannels";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useCanAccessChannel } from "@/hooks/useChannelPermissions";
import { useUserCommunityMembership } from "@/hooks/useUserCommunityMembership";
import { Lock, Radio, UserPlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JoinRequestDialog } from "@/components/community/JoinRequestDialog";
import type { NostrEvent } from "@nostrify/nostrify";

interface MessageListProps {
  communityId: string;
  channelId: string;
  onNavigateToDMs?: (targetPubkey: string) => void;
  onCloseCommunitySelectionDialog?: () => void;
  preloadedMessages?: NostrEvent[];
}

export function MessageList({ communityId, channelId, onNavigateToDMs, onCloseCommunitySelectionDialog, preloadedMessages }: MessageListProps) {
  const isMobile = useIsMobile();
  const { data: messages, isLoading, isSubscribed } = useMessages(communityId, channelId);
  const { data: pinnedMessageIds } = usePinnedMessages(communityId, channelId);
  const { data: channels } = useChannels(communityId);
  const { canAccess: canRead, reason } = useCanAccessChannel(communityId, channelId, 'read');
  const { data: membershipStatus } = useUserCommunityMembership(communityId);
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  // Use preloaded messages if available and user doesn't have read access, otherwise use regular messages
  const displayMessages = useMemo(() => {
    if (!canRead && preloadedMessages && preloadedMessages.length > 0) {
      return preloadedMessages;
    }
    return messages || [];
  }, [canRead, preloadedMessages, messages]);

  // Get the channel name from the channels data
  const channel = channels?.find(c => c.id === channelId);
  const channelName = channel?.name || 'this channel';

  // Filter out pinned messages from regular message list
  const regularMessages = useMemo(() => {
    return displayMessages.filter(message =>
      !pinnedMessageIds?.includes(message.id)
    );
  }, [displayMessages, pinnedMessageIds]);

  // If user doesn't have read access, check if we have preloaded messages to show as preview
  if (!canRead) {
    const isMemberOnlyAccess = reason?.includes('Only community members can access this channel');
    const isAlreadyMember = membershipStatus === 'owner' || membershipStatus === 'moderator' || membershipStatus === 'approved';
    const hasPreloadedMessages = preloadedMessages && preloadedMessages.length > 0;

    // If we have preloaded messages, show them with a preview banner
    if (hasPreloadedMessages) {
      return (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Preview Banner */}
          <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-yellow-400">
                  Preview Mode - You're viewing messages from this community
                </span>
              </div>
              {isMemberOnlyAccess && !isAlreadyMember && (
                <Button
                  onClick={() => setShowJoinDialog(true)}
                  size="sm"
                  className="flex items-center gap-1 h-7"
                >
                  <UserPlus className="w-3 h-3" />
                  Join to Participate
                </Button>
              )}
            </div>
          </div>

          {/* Show the regular message list with preloaded messages */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Pinned Messages Section */}
            {pinnedMessageIds && pinnedMessageIds.length > 0 && (
              <div className="border-b border-gray-700">
                <PinnedMessages
                  communityId={communityId}
                  channelId={channelId}
                  messageIds={pinnedMessageIds}
                  messages={displayMessages}
                />
              </div>
            )}

            {/* Regular Messages */}
            <div className="flex-1 overflow-hidden">
              {isLoading && displayMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400">Loading messages...</p>
                  </div>
                </div>
              ) : displayMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Radio className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No Messages Yet</h3>
                    <p className="text-gray-400 max-w-md">
                      This channel doesn't have any messages yet. Join the community to start the conversation!
                    </p>
                    {isMemberOnlyAccess && !isAlreadyMember && (
                      <Button
                        onClick={() => setShowJoinDialog(true)}
                        className="mt-4 flex items-center gap-2"
                      >
                        <UserPlus className="w-4 h-4" />
                        Join Community
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <Virtuoso
                  data={regularMessages}
                  itemContent={(index, message) => (
                    <MessageItem
                      key={message.id}
                      message={message}
                      showAvatar={true}
                      communityId={communityId}
                      channelId={channelId}
                      onNavigateToDMs={onNavigateToDMs}
                    />
                  )}
                  className="h-full"
                  followOutput="smooth"
                  initialTopMostItemIndex={Math.max(0, regularMessages.length - 1)}
                />
              )}
            </div>
          </div>

          {/* Join Community Dialog - only show if user is not already a member */}
          {!isAlreadyMember && (
            <JoinRequestDialog
              communityId={communityId}
              open={showJoinDialog}
              onOpenChange={setShowJoinDialog}
              onJoinSuccess={() => {
                // After successful join, the component will re-render and check permissions again
                setShowJoinDialog(false);
              }}
            />
          )}
        </div>
      );
    }

    // No preloaded messages, show regular access denied message
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 px-4">
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <Lock className="w-16 h-16 text-gray-500 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              Private Channel
            </h3>
            <p className="text-gray-400 max-w-md mb-6">
              {reason || "You don't have permission to view this channel"}
            </p>

            {isMemberOnlyAccess && !isAlreadyMember && (
              <Button
                onClick={() => setShowJoinDialog(true)}
                className="flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Join Community
              </Button>
            )}

            {isMemberOnlyAccess && isAlreadyMember && (
              <div className="space-y-4">
                <p className="text-sm text-yellow-400">
                  You're already a member of this community, but there might be a sync issue with channel permissions.
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      window.location.reload();
                      onCloseCommunitySelectionDialog?.();
                    }}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh Page
                  </Button>
                  <Button
                    onClick={() => onCloseCommunitySelectionDialog?.()}
                    variant="default"
                    className="flex items-center gap-2"
                  >
                    Close Browse Modal
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Join Community Dialog - only show if user is not already a member */}
        {!isAlreadyMember && (
          <JoinRequestDialog
            communityId={communityId}
            open={showJoinDialog}
            onOpenChange={setShowJoinDialog}
            onJoinSuccess={() => {
              // After successful join, the component will re-render and check permissions again
              setShowJoinDialog(false);
            }}
          />
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <PinnedMessages
          communityId={communityId}
          channelId={channelId}
          onNavigateToDMs={onNavigateToDMs}
        />
        <div className="flex-1 px-4">
          <div className="space-y-4 py-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex space-x-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Skeleton className="w-20 h-4" />
                    <Skeleton className="w-16 h-3" />
                  </div>
                  <Skeleton className="w-full h-4" />
                  <Skeleton className="w-3/4 h-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <PinnedMessages
          communityId={communityId}
          channelId={channelId}
          onNavigateToDMs={onNavigateToDMs}
        />
        <div className="flex-1 px-4">
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="text-6xl mb-4">👋</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Welcome to #{channelName}!
            </h3>
            <p className="text-gray-400 max-w-md mb-4">
              This is the beginning of the #{channelName} channel. Start the conversation!
            </p>
            {/* Real-time subscription status indicator */}
            <div className="flex items-center space-x-2 text-sm">
              {isSubscribed ? (
                <>
                  <Radio className="w-4 h-4 text-green-500 animate-pulse" />
                  <span className="text-green-400">Live subscription active</span>
                </>
              ) : (
                <>
                  <Radio className="w-4 h-4 text-orange-500" />
                  <span className="text-orange-400">Connecting...</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PinnedMessages
        communityId={communityId}
        channelId={channelId}
        onNavigateToDMs={onNavigateToDMs}
      />
      <Virtuoso
        className={`flex-1 ${isMobile ? 'px-3' : 'px-4'} channel-scroll`}
        style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}
        data={regularMessages}
        itemContent={(messageIndex, message) => {
          const previousMessage = messageIndex > 0 ? regularMessages[messageIndex - 1] : null;
          const showAvatar = !previousMessage ||
            previousMessage.pubkey !== message.pubkey ||
            (message.created_at - previousMessage.created_at) > 300; // 5 minutes
          return (
            <div className="message-item w-full max-w-full overflow-hidden">
              <MessageItem
                message={message}
                showAvatar={showAvatar}
                communityId={communityId}
                channelId={channelId}
                onNavigateToDMs={onNavigateToDMs}
              />
            </div>
          );
        }}
        followOutput="smooth"
        initialTopMostItemIndex={regularMessages.length - 1}
      />
    </div>
  );
}