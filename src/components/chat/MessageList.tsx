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

interface MessageListProps {
  communityId: string;
  channelId: string;
  onNavigateToDMs?: (targetPubkey: string) => void;
  onCloseCommunitySelectionDialog?: () => void;
}

export function MessageList({ communityId, channelId, onNavigateToDMs, onCloseCommunitySelectionDialog }: MessageListProps) {
  const isMobile = useIsMobile();
  const { data: messages, isLoading, isSubscribed } = useMessages(communityId, channelId);
  const { data: pinnedMessageIds } = usePinnedMessages(communityId, channelId);
  const { data: channels } = useChannels(communityId);
  const { canAccess: canRead, reason } = useCanAccessChannel(communityId, channelId, 'read');
  const { data: membershipStatus } = useUserCommunityMembership(communityId);
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  // Get the channel name from the channels data
  const channel = channels?.find(c => c.id === channelId);
  const channelName = channel?.name || 'this channel';

  // Filter out pinned messages from regular message list
  const regularMessages = useMemo(() => {
    return messages?.filter(message =>
      !pinnedMessageIds?.includes(message.id)
    ) || [];
  }, [messages, pinnedMessageIds]);

  // If user doesn't have read access, show access denied message
  if (!canRead) {
    const isMemberOnlyAccess = reason?.includes('Only community members can access this channel');
    const isAlreadyMember = membershipStatus === 'owner' || membershipStatus === 'moderator' || membershipStatus === 'approved';

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