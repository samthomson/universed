import { memo, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Ban, MoreHorizontal, Pin, Reply, Trash2, Loader2, Flag, Zap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { NoteContent } from "@/components/NoteContent";
import { UserContextMenu } from "@/components/user/UserContextMenu";
import { UserProfileDialog } from "@/components/profile/UserProfileDialog";
import { EmojiPickerComponent } from "@/components/ui/emoji-picker";
import { MessageReactions } from "@/components/chat/MessageReactions";
import { ZapButton } from "@/components/ZapButton";
import { ReportUserDialog } from "@/components/reporting/ReportUserDialog";
import { useCommunityContext } from "@/contexts/CommunityContext";
import { useUserRole } from "@/hooks/useCommunityRoles";

import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAddReaction } from "@/hooks/useAddReaction";
import { useReactionsAndZaps } from "@/hooks/useReactionsAndZaps";
import { isNewMessage } from "@/hooks/useNewMessageAnimation";
import { usePinnedMessages } from "@/hooks/usePinnedMessages";
import { genUserName } from "@/lib/genUserName";
import { formatDistanceToNowShort } from "@/lib/formatTime";
import type { NostrEvent } from "@/types/nostr";

export interface MessageItemConfig {
  showContextMenu: boolean;
  showReactions: boolean;
  showThreadReply: boolean;
  showPin: boolean;
  showDelete: boolean;
  showBan: boolean;
  showReport: boolean;
}

export interface BaseMessageItemProps {
  message: NostrEvent;
  showAvatar: boolean;
  config: MessageItemConfig;
  onReply?: (message: NostrEvent) => void;
  onPin?: (message: NostrEvent) => void;
  onDelete?: (message: NostrEvent, reason?: string) => void;
  onBan?: (pubkey: string, reason?: string) => void;
  onNavigateToDMs?: (targetPubkey: string) => void;
  communityId?: string;
  channelId?: string;
}

function BaseMessageItemComponent({
  message,
  showAvatar,
  config,
  onReply,
  onPin,
  onDelete,
  onBan,
  onNavigateToDMs,
  communityId,
  channelId,
}: BaseMessageItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);

  const author = useAuthor(message.pubkey);
  const { user } = useCurrentUser();
  const { mutate: addReaction } = useAddReaction();
  const { data: pinnedMessageIds } = usePinnedMessages(communityId || '', channelId || '');
  const { data: reactionsAndZaps } = useReactionsAndZaps(message.id);
  const { currentCommunityId } = useCommunityContext();
  const { role } = useUserRole(currentCommunityId || '');
  const isAdmin = role === 'owner' || role === 'admin';
  
  const metadata = author.data?.metadata;
  const isSending = message.isSending;
  const isNew = isNewMessage(message);

  const isPinned = pinnedMessageIds?.includes(message.id) || false;

  const displayName = metadata?.name || genUserName(message.pubkey);
  const profileImage = metadata?.picture;
  const timestamp = new Date(message.created_at * 1000);

  // Keep actions visible if any interactive element is open
  const shouldShowActions = isHovered || isEmojiPickerOpen || isDropdownOpen;

  const handleProfileClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (user?.pubkey !== message.pubkey) {
      setShowProfileDialog(true);
    }
  }, [user?.pubkey, message.pubkey]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    addReaction({ targetEvent: message, emoji });
    setIsEmojiPickerOpen(false);
    setIsHovered(false); // Hide actions after selecting emoji
  }, [addReaction, message]);

  const handleEmojiPickerOpenChange = useCallback((open: boolean) => {
    setIsEmojiPickerOpen(open);
  }, []);

  const handleDropdownOpenChange = useCallback((open: boolean) => {
    setIsDropdownOpen(open);
  }, []);

  return (
    <div
      className={cn(
        "group relative hover:bg-secondary/50 transition-all duration-200 w-full px-4 py-1",
        {
          "mt-4": showAvatar,
          "opacity-50": isSending,
          "new-message-animation": isNew && !isSending,
        },
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex space-x-3">
        <div className="w-10 flex-shrink-0">
          {showAvatar
            ? (
              <UserContextMenu
                pubkey={message.pubkey}
                displayName={displayName}
              >
                <div
                  className="relative cursor-pointer"
                  onClick={handleProfileClick}
                >
                  <Avatar className="w-10 h-10 hover:opacity-80 transition-opacity">
                    <AvatarImage src={profileImage} alt={displayName} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </UserContextMenu>
            )
            : (
              <div className="h-5 flex items-center justify-center w-10">
                {shouldShowActions && (
                  <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-200 font-medium">
                    {timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            )}
        </div>

        <div className="flex-1 min-w-0">
          {showAvatar && (
            <div className="flex items-baseline space-x-2 mb-1">
              <UserContextMenu
                pubkey={message.pubkey}
                displayName={displayName}
              >
                <span
                  className="font-semibold hover:underline cursor-pointer"
                  onClick={handleProfileClick}
                >
                  {displayName}
                </span>
              </UserContextMenu>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNowShort(timestamp, { addSuffix: true })}
                {isSending && (
                  <div className="flex items-center space-x-1 inline-flex ml-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-xs">Sending...</span>
                  </div>
                )}
              </span>
            </div>
          )}
          <div className="text-foreground break-words">
            <div className="flex items-center gap-2">
              <NoteContent event={message} className="text-sm leading-relaxed" />
              {isSending && !showAvatar && (
                <div className="flex items-center space-x-1 flex-shrink-0">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-xs">Sending...</span>
                </div>
              )}
            </div>
          </div>

          {/* Message Reactions */}
          {config.showReactions && reactionsAndZaps && (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {/* Zap Count Display - Left of emojis */}
                {reactionsAndZaps?.totalSats > 0 && (
                  <div className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400 h-6">
                    <Zap className="h-3 w-3 flex-shrink-0" />
                    <span>{reactionsAndZaps.totalSats.toLocaleString()} sats</span>
                    {reactionsAndZaps.zapCount > 1 && (
                      <span className="text-muted-foreground">({reactionsAndZaps.zapCount} zaps)</span>
                    )}
                  </div>
                )}
              {/* Emoji Reactions */}
                <div className="flex items-center h-6">
                  <MessageReactions
                    message={message}
                    onReactionClick={() => setIsHovered(false)}
                    reactionGroups={reactionsAndZaps.reactionGroups}
                  />
                </div>
            </div>
          )}
        </div>

        {shouldShowActions && (
          <div className={cn(
            "absolute bg-background border rounded-md shadow-lg flex items-center right-4 z-10",
            showAvatar
              ? "-top-2"
              : "top-1/2 -translate-y-1/2"
          )}>
            {config.showThreadReply && (
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 rounded-r-none"
                onClick={() => onReply?.(message)}
                title="Reply"
              >
                <Reply className="w-4 h-4" />
              </Button>
            )}
            {config.showReactions && (
              <EmojiPickerComponent
                onEmojiSelect={handleEmojiSelect}
                onOpenChange={handleEmojiPickerOpenChange}
                side="top"
                align="center"
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 rounded-none"
                    title="Add Reaction"
                  >
                    😊
                  </Button>
                }
              />
            )}
            <ZapButton
              target={message}
              className=""
            />
            <DropdownMenu onOpenChange={handleDropdownOpenChange}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 rounded-l-none"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {config.showPin && (
                  <DropdownMenuItem onClick={() => onPin?.(message)}>
                    <Pin className="mr-2 h-4 w-4" />
                    {isPinned ? 'Unpin Message' : 'Pin Message'}
                  </DropdownMenuItem>
                )}
                {config.showDelete && user?.pubkey === message.pubkey && (
                  <DropdownMenuItem onClick={() => onDelete?.(message)}>
                    <Trash2 className="mr-2 h-4 w-4" />Delete
                  </DropdownMenuItem>
                )}
                {config.showBan && isAdmin && (
                  <DropdownMenuItem
                    onClick={() => onBan?.(message.pubkey)}
                    className="text-destructive"
                  >
                    <Ban className="mr-2 h-4 w-4" />Ban User
                  </DropdownMenuItem>
                )}
                {config.showReport && user?.pubkey !== message.pubkey && (
                  <DropdownMenuItem
                    onClick={() => setShowReportDialog(true)}
                    className="text-destructive"
                  >
                    <Flag className="mr-2 h-4 w-4" />Report User
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <UserProfileDialog
        pubkey={message.pubkey}
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        onStartDM={onNavigateToDMs}
      />

      {/* Report User Dialog */}
      <ReportUserDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        targetPubkey={message.pubkey}
        targetDisplayName={displayName}
        communityId={currentCommunityId || undefined}
      />
    </div>
  );
}

export const BaseMessageItem = memo(
  BaseMessageItemComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.content === nextProps.message.content &&
      prevProps.message.isSending === nextProps.message.isSending &&
      prevProps.message.clientFirstSeen === nextProps.message.clientFirstSeen &&
      prevProps.showAvatar === nextProps.showAvatar
    );
  },
);
