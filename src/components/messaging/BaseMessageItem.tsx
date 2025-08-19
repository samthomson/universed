import { memo, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Ban, MoreHorizontal, Pin, Reply, Trash2, Loader2, Flag, Zap, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CompactMarketplaceItemCard } from "./CompactMarketplaceItemCard";
import { parseMarketplaceItemMessage, extractHumanReadableMessage } from "@/lib/marketplaceDM";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { NoteContent } from "@/components/NoteContent";
import { UserContextMenu } from "@/components/user/UserContextMenu";
import { ProfileModal } from "@/components/user/ProfileModal";
import { EmojiPickerComponent } from "@/components/ui/emoji-picker";
import { MessageReactions } from "@/components/chat/MessageReactions";
import { MessageThread } from "@/components/chat/MessageThread";
import { ZapButton } from "@/components/ZapButton";
import { ReportUserDialog } from "@/components/reporting/ReportUserDialog";
import { useCommunityContext } from "@/contexts/communityHooks";
import { useUserRole } from "@/hooks/useCommunityRoles";

import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAddReaction } from "@/hooks/useAddReaction";
import { useReactionsAndZaps } from "@/hooks/useReactionsAndZaps";
import { useMessageHasReplies, useMessageReplyCount } from "@/hooks/useMessageHasReplies";
import { isNewMessage } from "@/hooks/useNewMessageAnimation";
import { usePinnedMessages } from "@/hooks/usePinnedMessages";
import { genUserName } from "@/lib/genUserName";
import { formatDistanceToNowShort } from "@/lib/formatTime";
import { getMessageProtocol } from "@/hooks/useDirectMessages";
import { ProtocolIndicator } from "@/components/dm/ProtocolIndicator";
import type { NostrEvent } from "@/types/nostr";

export interface MessageItemConfig {
  showContextMenu: boolean;
  showReactions: boolean;
  showThreadReply: boolean;
  showPin: boolean;
  showDelete: boolean;
  showBan: boolean;
  showReport: boolean;
  asMyMessageRightAlign: boolean;
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
  const [currentProfilePubkey, setCurrentProfilePubkey] = useState(message.pubkey);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [_showSettingsDialog, _setShowSettingsDialog] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showThreadDialog, setShowThreadDialog] = useState(false);

  const author = useAuthor(message.pubkey);
  const { user } = useCurrentUser();
  const { mutate: addReaction } = useAddReaction();
  
  // Check if this message is from the current user for right alignment
  const shouldAlignRight = user?.pubkey === message.pubkey;
  const { data: pinnedMessageIds } = usePinnedMessages(communityId || '', channelId || '');
  const { data: reactionsAndZaps } = useReactionsAndZaps(message.id);
  const { data: hasReplies } = useMessageHasReplies(message.id);
  const { data: replyCount } = useMessageReplyCount(message.id);
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
    // Allow profile modal to open for any user (including self)
    setShowProfileDialog(true);
  }, []);

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

  const handleProfileChange = useCallback((newPubkey: string) => {
    setCurrentProfilePubkey(newPubkey);
  }, []);

  return (
    <div
      className={cn(
        "group relative transition-all duration-200 w-full px-4 py-2",
        {
          "mt-4": showAvatar,
          "opacity-50": isSending,
          "new-message-animation": isNew && !isSending,
        },
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={cn("flex", {
        // Right-aligned messages: justify-end with proper bubble styling
        "justify-end": shouldAlignRight,
        // Left-aligned messages: normal flex with hover background
        "hover:bg-purple-50 dark:hover:bg-purple-900/10 rounded-2xl": !shouldAlignRight,
      })}>
        <div className={cn("flex space-x-3 relative", {
          "flex-row-reverse space-x-reverse": shouldAlignRight,
          // Message bubble styling for user's own messages
          "max-w-[80%] bg-purple-600/20 dark:bg-purple-500/20 rounded-2xl px-3 py-2": shouldAlignRight,
        })}>
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
                    <Avatar className="w-10 h-10 hover:opacity-80 transition-opacity ring-2 ring-purple-200 dark:ring-purple-800">
                      <AvatarImage src={profileImage} alt={displayName} />
                      <AvatarFallback className="bg-purple-600 text-white">
                        {displayName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </UserContextMenu>
              )
              : (
                <div className="h-5 flex items-center justify-center w-10">
                  {shouldShowActions && (
                    <span className="text-xs text-gray-600 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-all duration-200 font-medium">
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
              <div className={cn("flex items-baseline space-x-2 mb-1", {
                "flex-row-reverse space-x-reverse": shouldAlignRight,
              })}>
                <UserContextMenu
                  pubkey={message.pubkey}
                  displayName={displayName}
                >
                  <span
                    className="font-semibold text-gray-900 dark:text-gray-100 hover:text-purple-600 dark:hover:text-purple-400 hover:underline cursor-pointer"
                    onClick={handleProfileClick}
                  >
                    {displayName}
                  </span>
                </UserContextMenu>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {formatDistanceToNowShort(timestamp, { addSuffix: true })}
                  {/* Only show protocol indicators for DM messages (kinds 4, 14, 1059) */}
                  {[4, 14, 1059].includes(message.kind) && (() => {
                    const protocol = getMessageProtocol(message.kind);
                    // Only show indicator for known protocols
                    if (protocol === 'NIP04' || protocol === 'NIP17') {
                      return (
                        <span className="inline-block ml-2">
                          <ProtocolIndicator protocol={protocol} />
                        </span>
                      );
                    }
                    return null;
                  })()}
                  {isSending && (
                    <div className="flex items-center space-x-1 inline-flex ml-2">
                      <Loader2 className="w-3 h-3 animate-spin text-purple-600 dark:text-purple-400" />
                      <span className="text-xs text-purple-600 dark:text-purple-400">Sending...</span>
                    </div>
                  )}
                </span>
              </div>
            )}
            <div className={cn("text-gray-900 dark:text-gray-100 break-word whitespace-pre-wrap", {
              "text-left": shouldAlignRight, // Force left alignment for content even when message is right-aligned
            })}>
              <div className="flex items-center gap-2">
                {(() => {
                  // Check if this is a marketplace item message
                  const marketplaceItem = parseMarketplaceItemMessage(message.content);
                  if (marketplaceItem) {
                    return (
                      <div className="w-full">
                        <CompactMarketplaceItemCard
                          item={marketplaceItem}
                          className="mb-2"
                        />
                        <div className="text-xs text-gray-500 italic text-left">
                          {extractHumanReadableMessage(message.content)}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <NoteContent event={message} className="text-sm leading-relaxed text-left" onNavigateToDMs={onNavigateToDMs} />
                  );
                })()}
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
                {/* Emoji Reactions - Only render wrapper if there are reactions */}
                  {reactionsAndZaps.reactionGroups && Object.keys(reactionsAndZaps.reactionGroups).length > 0 && (
                    <div className="flex items-center h-6">
                      <MessageReactions
                        message={message}
                        onReactionClick={() => setIsHovered(false)}
                        reactionGroups={reactionsAndZaps.reactionGroups}
                      />
                    </div>
                  )}
              </div>
            )}

            {/* Reply Count Display - Always show when there are replies, independent of reactions */}
            {config.showThreadReply && hasReplies && (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <button
                  onClick={() => setShowThreadDialog(true)}
                  className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer h-6"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
                </button>
              </div>
            )}
          </div>

          {shouldShowActions && (
            <div className={cn(
              "absolute bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 backdrop-blur-sm rounded-xl shadow-sm flex items-center z-10",
              showAvatar
                ? "-top-2"
                : "top-1/2 -translate-y-1/2",
              shouldAlignRight ? "-left-20" : "-right-16" // Good clearance: far left for right-aligned, much further right for left-aligned
            )}>
              {config.showThreadReply && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-9 h-9 sm:w-8 sm:h-8 rounded-l-xl text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-purple-100 dark:hover:bg-purple-900/20 mobile-button"
                  onClick={() => onReply?.(message)}
                  title="Reply"
                >
                  <Reply className="w-4 h-4 sm:w-4 sm:h-4" />
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
                      className="w-9 h-9 sm:w-8 sm:h-8 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-purple-100 dark:hover:bg-purple-900/20 mobile-button"
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
                    className="w-9 h-9 sm:w-8 sm:h-8 rounded-r-xl text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-purple-100 dark:hover:bg-purple-900/20 mobile-button"
                  >
                    <MoreHorizontal className="w-4 h-4 sm:w-4 sm:h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-800 backdrop-blur-sm rounded-xl shadow-sm">
                  {config.showPin && (
                    <DropdownMenuItem onClick={() => onPin?.(message)} className="text-gray-900 dark:text-gray-100 hover:bg-purple-100 dark:hover:bg-purple-900/20 focus:bg-purple-100 dark:hover:bg-purple-900/20 rounded-lg">
                      <Pin className="mr-2 h-4 w-4 text-purple-600 dark:text-purple-400" />
                      {isPinned ? 'Unpin Message' : 'Pin Message'}
                    </DropdownMenuItem>
                  )}
                  {config.showDelete && user?.pubkey === message.pubkey && (
                    <DropdownMenuItem onClick={() => onDelete?.(message)} className="text-gray-900 dark:text-gray-100 hover:bg-purple-100 dark:hover:bg-purple-900/20 focus:bg-purple-100 dark:hover:bg-purple-900/20 rounded-lg">
                      <Trash2 className="mr-2 h-4 w-4 text-red-500" />Delete
                    </DropdownMenuItem>
                  )}
                  {config.showBan && isAdmin && (
                    <DropdownMenuItem
                      onClick={() => onBan?.(message.pubkey)}
                      className="text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 focus:bg-red-100 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      <Ban className="mr-2 h-4 w-4 text-red-500" />Ban User
                    </DropdownMenuItem>
                  )}
                  {config.showReport && user?.pubkey !== message.pubkey && (
                    <DropdownMenuItem
                      onClick={() => setShowReportDialog(true)}
                      className="text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 focus:bg-red-100 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      <Flag className="mr-2 h-4 w-4 text-red-500" />Report User
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      <ProfileModal
        targetPubkey={currentProfilePubkey}
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        onOpenSettings={() => _setShowSettingsDialog(true)}
        onNavigateToDMs={onNavigateToDMs}
        onProfileChange={handleProfileChange}
      />

      {/* Report User Dialog */}
      <ReportUserDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        targetPubkey={message.pubkey}
        targetDisplayName={displayName}
        communityId={currentCommunityId || undefined}
      />

      {/* Thread Dialog */}
      <MessageThread
        rootMessage={message}
        open={showThreadDialog}
        onOpenChange={setShowThreadDialog}
        onNavigateToDMs={onNavigateToDMs}
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