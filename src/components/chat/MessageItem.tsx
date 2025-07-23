import { useState } from "react";
import { MoreHorizontal, Reply, Smile, Pin, PinOff, Trash2, VolumeX, Ban } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmojiPickerComponent } from "@/components/ui/emoji-picker";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { NoteContent } from "@/components/NoteContent";
import { MessageReactions } from "./MessageReactions";
import { MessageThread } from "./MessageThread";
import { MessageContextMenu } from "./MessageContextMenu";
import { UserContextMenu } from "@/components/user/UserContextMenu";
import { UserStatusIndicator } from "@/components/user/UserStatusIndicator";

import { UserProfileDialog } from "@/components/profile/UserProfileDialog";
import { useAuthor } from "@/hooks/useAuthor";
import { useEmojiReactions } from "@/hooks/useEmojiReactions";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useThreadReplies } from "@/hooks/useThreadReplies";
import { useCanModerate } from "@/hooks/useCommunityRoles";
import { usePinMessage, useUnpinMessage, useIsPinned, getMessageChannelId } from "@/hooks/usePinnedMessages";
import { useIsBlocked, useIsMuted } from "@/hooks/useBlockedUsers";
import { useDeleteMessage } from "@/hooks/useMessageActions";
import { useModerationActions } from "@/hooks/useModerationActions";
import { DeletionConfirmDialog } from "@/components/moderation/DeletionConfirmDialog";
import { useToast } from "@/hooks/useToast";
import { genUserName } from "@/lib/genUserName";
import { formatDistanceToNow } from "date-fns";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { NostrEvent } from "@nostrify/nostrify";

interface MessageItemProps {
  message: NostrEvent;
  showAvatar: boolean;
  communityId?: string;
  channelId?: string;
  onNavigateToDMs?: (targetPubkey: string) => void;
}

export function MessageItem({ message, showAvatar, communityId, channelId, onNavigateToDMs }: MessageItemProps) {
  const isMobile = useIsMobile();
  const [isHovered, setIsHovered] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [showMuteDialog, setShowMuteDialog] = useState(false);
  const author = useAuthor(message.pubkey);
  const metadata = author.data?.metadata;
  const { addReaction } = useEmojiReactions();
  const { mutate: pinMessage } = usePinMessage();
  const { mutate: unpinMessage } = useUnpinMessage();
  const { user } = useCurrentUser();
  const { mutate: deleteMessage, isPending: isDeleting } = useDeleteMessage(communityId);
  const moderationActions = useModerationActions();
  const { toast } = useToast();
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

  const handleDeleteMessage = (reason?: string) => {
    deleteMessage(
      { messageEvent: message, reason },
      {
        onSuccess: () => {
          toast({
            title: "Message deleted",
            description: "Message deleted by moderator",
          });
        },
        onError: (error) => {
          console.error('Failed to delete message:', error);
          toast({
            title: "Failed to delete message",
            description: "There was an error deleting the message. Please try again.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const handleBanUser = (reason?: string) => {
    moderationActions.banUser.mutate(
      {
        communityId: communityId || '',
        userPubkey: message.pubkey,
        reason
      },
      {
        onSuccess: () => {
          toast({
            title: "User banned",
            description: "User has been banned from the community",
          });
        },
        onError: (error) => {
          console.error('Failed to ban user:', error);
          toast({
            title: "Failed to ban user",
            description: "There was an error banning the user. Please try again.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const handleMuteUser = (reason?: string) => {
    moderationActions.muteUser.mutate(
      {
        communityId: communityId || '',
        userPubkey: message.pubkey,
        reason
      },
      {
        onSuccess: () => {
          toast({
            title: "User muted",
            description: "User has been muted in the community",
          });
        },
        onError: (error) => {
          console.error('Failed to mute user:', error);
          toast({
            title: "Failed to mute user",
            description: "There was an error muting the user. Please try again.",
            variant: "destructive",
          });
        }
      }
    );
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
        className={`group relative ${isMobile ? 'px-3 py-2' : 'px-4 py-1'} hover:bg-gray-800/30 transition-all duration-200 ${
          showAvatar ? (isMobile ? 'mt-3' : 'mt-4') : ''
        } ${messageOpacity} ${isMobile ? 'mobile-touch' : ''} ${isHovered && !isMobile ? 'bg-gray-800/20' : ''}`}
        onMouseEnter={() => !isMobile && setIsHovered(true)}
        onMouseLeave={() => !isMobile && !isDropdownOpen && setIsHovered(false)}
        onClick={() => isMobile && setIsHovered(!isHovered)}
      >
        {/* Pinned indicator */}
        {isPinned && (
          <div className="flex items-center space-x-1 mb-2 text-xs text-yellow-500">
            <Pin className="w-3 h-3" />
            <span>Pinned Message</span>
          </div>
        )}

        <div className={`flex ${isMobile ? 'space-x-2' : 'space-x-3'}`}>
          {/* Avatar */}
          <div className={`${isMobile ? 'w-8' : 'w-10'} flex-shrink-0`}>
            {showAvatar ? (
              <UserContextMenu pubkey={message.pubkey} displayName={displayName}>
                <div className="relative cursor-pointer" onClick={handleProfileClick}>
                  <Avatar className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} hover:opacity-80 transition-opacity`}>
                    <AvatarImage src={profileImage} alt={displayName} />
                    <AvatarFallback className={`bg-indigo-600 text-white ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      {displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1">
                    <UserStatusIndicator pubkey={message.pubkey} />
                  </div>
                </div>
              </UserContextMenu>
            ) : (
              <div className={`${isMobile ? 'w-8' : 'w-10'} h-5 flex items-center justify-center`}>
                {isHovered && !isMobile && (
                  <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-all duration-200 font-medium">
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
              <NoteContent event={message} className={`${isMobile ? 'text-base' : 'text-sm'} leading-relaxed`} />
            </div>

            {/* Reactions */}
            <MessageReactions message={message} />

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

          {/* Message Actions - Same for both Desktop and Mobile */}
          {isHovered && (
            <div className={`absolute ${isMobile ? '-top-1 right-2' : '-top-2 right-4'} bg-gray-700 border border-gray-600 rounded-md shadow-lg flex items-center divide-x divide-gray-600`}>
              {/* Quick Actions Group */}
              <div className="flex items-center">
                {/* Quick Reply Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={`${isMobile ? 'w-9 h-9' : 'w-8 h-8'} hover:bg-gray-600 rounded-l-md rounded-r-none`}
                  onClick={() => setShowThread(true)}
                  title="Reply"
                >
                  <Reply className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'}`} />
                </Button>

                {/* Quick React Button */}
                <EmojiPickerComponent
                  onEmojiSelect={handleEmojiSelect}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`${isMobile ? 'w-9 h-9' : 'w-8 h-8'} hover:bg-gray-600 rounded-none`}
                      title="Add reaction"
                    >
                      <Smile className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'}`} />
                    </Button>
                  }
                  side="top"
                  align="end"
                />
              </div>

              {/* More Actions Group */}
              <div className="flex items-center">
                <DropdownMenu onOpenChange={(open) => {
                  setIsDropdownOpen(open);
                  // Reset hover state when dropdown closes on desktop
                  if (!open && !isMobile) {
                    setIsHovered(false);
                  }
                }}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`${isMobile ? 'w-9 h-9' : 'w-8 h-8'} hover:bg-gray-600 rounded-r-md rounded-l-none`}
                      title="More actions"
                    >
                      <MoreHorizontal className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'}`} />
                    </Button>
                  </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {communityId && messageChannelId && (
                    <DropdownMenuItem onClick={handleTogglePin}>
                      {isPinned ? (
                        <>
                          <PinOff className="mr-2 h-4 w-4" />
                          Unpin Message
                        </>
                      ) : (
                        <>
                          <Pin className="mr-2 h-4 w-4" />
                          Pin Message
                        </>
                      )}
                    </DropdownMenuItem>
                  )}

                  {canModerate && user?.pubkey !== message.pubkey && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setShowDeleteDialog(true)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Message
                      </DropdownMenuItem>

                      <DropdownMenuItem onClick={() => setShowMuteDialog(true)}>
                        <VolumeX className="mr-2 h-4 w-4" />
                        Mute User
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => setShowBanDialog(true)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        Ban User
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
                </DropdownMenu>
              </div>
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

        {/* Moderation Dialogs */}
        <DeletionConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title="Delete Message (Moderator)"
          description="You are about to delete another user's message as a moderator."
          itemName="this message"
          itemType="message"
          requireReason={true}
          onConfirm={handleDeleteMessage}
          isDeleting={isDeleting}
        />

        <DeletionConfirmDialog
          open={showBanDialog}
          onOpenChange={setShowBanDialog}
          title="Ban User"
          description="You are about to ban this user from the community."
          itemName="this user"
          itemType="message"
          warningMessage="The user will be removed from the community and unable to rejoin."
          requireReason={true}
          requireConfirmation={true}
          onConfirm={handleBanUser}
          destructiveAction={true}
        />

        <DeletionConfirmDialog
          open={showMuteDialog}
          onOpenChange={setShowMuteDialog}
          title="Mute User"
          description="You are about to mute this user in the community."
          itemName="this user"
          itemType="message"
          warningMessage="The user will not be able to send messages in this community."
          requireReason={true}
          onConfirm={handleMuteUser}
          destructiveAction={false}
        />
      </div>
    </MessageContextMenu>
  );
}