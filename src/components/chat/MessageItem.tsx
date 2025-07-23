import { useState } from "react";
import { MoreHorizontal, Reply, Smile, Pin, PinOff, Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmojiPickerComponent } from "@/components/ui/emoji-picker";
import { NoteContent } from "@/components/NoteContent";
import { MessageReactions } from "./MessageReactions";
import { MessageThread } from "./MessageThread";
import { MessageContextMenu } from "./MessageContextMenu";
import { UserContextMenu } from "@/components/user/UserContextMenu";
import { UserStatusIndicator } from "@/components/user/UserStatusIndicator";
import { ModerationActionsMenu } from "@/components/moderation/ModerationActionsMenu";
import { UserProfileDialog } from "@/components/profile/UserProfileDialog";
import { useAuthor } from "@/hooks/useAuthor";
import { useEmojiReactions } from "@/hooks/useEmojiReactions";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useThreadReplies } from "@/hooks/useThreadReplies";
import { useCanModerate } from "@/hooks/useCommunityRoles";
import { usePinMessage, useUnpinMessage, useIsPinned, getMessageChannelId } from "@/hooks/usePinnedMessages";
import { useIsBlocked, useIsMuted } from "@/hooks/useBlockedUsers";
import { genUserName } from "@/lib/genUserName";
import { formatDistanceToNow } from "date-fns";
import type { NostrEvent } from "@nostrify/nostrify";

interface MessageItemProps {
  message: NostrEvent;
  showAvatar: boolean;
  communityId?: string;
  channelId?: string;
  onNavigateToDMs?: (targetPubkey: string) => void;
}

export function MessageItem({ message, showAvatar, communityId, channelId, onNavigateToDMs }: MessageItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const author = useAuthor(message.pubkey);
  const metadata = author.data?.metadata;
  const { addReaction } = useEmojiReactions();
  const { mutate: pinMessage } = usePinMessage();
  const { mutate: unpinMessage } = useUnpinMessage();
  const { user } = useCurrentUser();
  const { data: replies } = useThreadReplies(message.id);
  const isBlocked = useIsBlocked(message.pubkey);
  const isMuted = useIsMuted(message.pubkey);
  const { canModerate } = useCanModerate(communityId || '');
  // Extract channel ID from the message if not provided
  const messageChannelId = channelId || getMessageChannelId(message);
  const isPinned = useIsPinned(communityId || '', messageChannelId || '', message.id);

  const displayName = metadata?.name || genUserName(message.pubkey);
  const profileImage = metadata?.picture;
  const timestamp = new Date(message.created_at * 1000);

  // Don't render blocked messages
  if (isBlocked) {
    return null;
  }

  // Show muted messages with reduced opacity
  const messageOpacity = isMuted ? 'opacity-50' : '';

  const handleEmojiSelect = (emoji: string) => {
    if (!user) return;
    addReaction({
      targetEvent: message,
      emoji,
    });
  };

  const handleTogglePin = () => {
    if (!communityId || !messageChannelId) return;

    if (isPinned) {
      unpinMessage({ communityId, channelId: messageChannelId, messageId: message.id });
    } else {
      pinMessage({ communityId, channelId: messageChannelId, messageId: message.id });
    }
  };

  const replyCount = replies?.length || 0;

  const handleProfileClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (user?.pubkey !== message.pubkey) {
      setShowProfileDialog(true);
    }
  };

  const handleStartDM = (pubkey: string) => {
    onNavigateToDMs?.(pubkey);
    setShowProfileDialog(false);
  };

  return (
    <MessageContextMenu
      message={message}
      onReply={() => setShowThread(true)}
      communityId={communityId}
    >
      <div
        className={`group relative px-4 py-1 hover:bg-gray-800/50 transition-colors ${
          showAvatar ? 'mt-4' : ''
        } ${messageOpacity}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Pinned indicator */}
        {isPinned && (
          <div className="flex items-center space-x-1 mb-2 text-xs text-yellow-500">
            <Pin className="w-3 h-3" />
            <span>Pinned Message</span>
          </div>
        )}

        <div className="flex space-x-3">
          {/* Avatar */}
          <div className="w-10 flex-shrink-0">
            {showAvatar ? (
              <UserContextMenu pubkey={message.pubkey} displayName={displayName}>
                <div className="relative cursor-pointer" onClick={handleProfileClick}>
                  <Avatar className="w-10 h-10 hover:opacity-80 transition-opacity">
                    <AvatarImage src={profileImage} alt={displayName} />
                    <AvatarFallback className="bg-indigo-600 text-white text-sm">
                      {displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1">
                    <UserStatusIndicator pubkey={message.pubkey} />
                  </div>
                </div>
              </UserContextMenu>
            ) : (
              <div className="w-10 h-5 flex items-center justify-center">
                {isHovered && (
                  <span className="text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    {timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Message Content */}
          <div className="flex-1 min-w-0">
            {showAvatar && (
              <div className="flex items-baseline space-x-2 mb-1">
                <UserContextMenu pubkey={message.pubkey} displayName={displayName}>
                  <span
                    className="font-semibold text-white hover:underline cursor-pointer"
                    onClick={handleProfileClick}
                  >
                    {displayName}
                  </span>
                </UserContextMenu>
                {isMuted && (
                  <Badge variant="secondary" className="text-xs">
                    Muted
                  </Badge>
                )}
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(timestamp, { addSuffix: true })}
                </span>
              </div>
            )}

            <div className="text-gray-100 break-words">
              <NoteContent event={message} className="text-sm leading-relaxed" />
            </div>

            {/* Reactions */}
            <MessageReactions message={message} />

            {/* Moderation Actions */}
            {canModerate && user?.pubkey !== message.pubkey && (
              <div className="mt-2">
                <ModerationActionsMenu
                  message={message}
                  communityId={communityId || ''}
                  channelId={messageChannelId || undefined}
                  variant="inline"
                />
              </div>
            )}

            {/* Thread Reply Count */}
            {replyCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-6 px-2 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/20"
                onClick={() => setShowThread(true)}
              >
                {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
              </Button>
            )}
          </div>

          {/* Message Actions */}
          {isHovered && (
            <div className="absolute -top-2 right-4 bg-gray-700 border border-gray-600 rounded-md shadow-lg flex">
              <EmojiPickerComponent
                onEmojiSelect={handleEmojiSelect}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 hover:bg-gray-600"
                  >
                    <Smile className="w-4 h-4" />
                  </Button>
                }
                side="top"
                align="end"
              />
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 hover:bg-gray-600"
                onClick={() => setShowThread(true)}
              >
                <Reply className="w-4 h-4" />
              </Button>
              {communityId && messageChannelId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 hover:bg-gray-600"
                  onClick={handleTogglePin}
                >
                  {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                </Button>
              )}
              {canModerate && user?.pubkey !== message.pubkey ? (
                <ModerationActionsMenu
                  message={message}
                  communityId={communityId || ''}
                  channelId={messageChannelId || undefined}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 hover:bg-gray-600"
                    >
                      <Shield className="w-4 h-4" />
                    </Button>
                  }
                />
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 hover:bg-gray-600"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Thread Sheet */}
        <MessageThread
          rootMessage={message}
          open={showThread}
          onOpenChange={setShowThread}
          onNavigateToDMs={onNavigateToDMs}
        />

        {/* User Profile Dialog */}
        <UserProfileDialog
          pubkey={message.pubkey}
          open={showProfileDialog}
          onOpenChange={setShowProfileDialog}
          onStartDM={handleStartDM}
        />
      </div>
    </MessageContextMenu>
  );
}