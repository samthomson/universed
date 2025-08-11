import { Pin, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { NoteContent } from "@/components/NoteContent";
import { usePinnedMessageEvents, useUnpinMessage } from "@/hooks/usePinnedMessages";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";
import { formatDistanceToNowShort } from "@/lib/formatTime";
import { useState, useMemo } from "react";
import type { NostrEvent } from "@nostrify/nostrify";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PinnedMessagesProps {
  communityId: string;
  channelId: string;
  onNavigateToDMs?: (targetPubkey: string) => void;
  messages?: NostrEvent[];
  messageIds?: string[];
}

export function PinnedMessages({ communityId, channelId, onNavigateToDMs, messages, messageIds }: PinnedMessagesProps) {
  const { data: pinnedMessages, isLoading } = usePinnedMessageEvents(communityId, channelId);
  const [isExpanded, setIsExpanded] = useState(false);

  // Use passed messages if available, otherwise use fetched pinned messages
  const displayMessages = useMemo(() => {
    let toDisplay = messages || [];
    if (toDisplay && messageIds) {
      toDisplay = toDisplay.filter(message => messageIds.includes(message.id));
    } else {
      toDisplay = pinnedMessages || [];
    }

    // Sort messages by created_at timestamp in descending order (newest first)
    return toDisplay.sort((a, b) => b.created_at - a.created_at);
  }, [messages, messageIds, pinnedMessages]);

  // Don't render anything if there are no pinned messages
  if (!isLoading && displayMessages.length === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700/50">
        <div className="px-4 py-2">
          <div className="flex items-center space-x-2">
            <Pin className="w-3 h-3 text-yellow-500" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </div>
    );
  }

  const firstMessage = displayMessages[0];

  return (
    <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700/50">
      <div className="px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start h-auto p-2 hover:bg-gray-800/50"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <Pin className="w-3 h-3 text-yellow-500 flex-shrink-0" />
            <span className="text-xs text-yellow-500 flex-shrink-0">
              {pinnedMessages?.length} pinned
            </span>
            {firstMessage && !isExpanded && (
              <PinnedMessagePreview message={firstMessage} onNavigateToDMs={onNavigateToDMs} />
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="w-3 h-3 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
          )}
        </Button>

        {isExpanded && (
          <div className="mt-2 space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
            {displayMessages.map((message) => (
              <PinnedMessageItem
                key={message.id}
                message={message}
                communityId={communityId}
                channelId={channelId}
                onNavigateToDMs={onNavigateToDMs}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PinnedMessagePreview({ message, onNavigateToDMs: _onNavigateToDMs }: { message: NostrEvent; onNavigateToDMs?: (targetPubkey: string) => void }) {
  const author = useAuthor(message.pubkey);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || genUserName(message.pubkey);

  return (
    <div className="flex items-center space-x-2 min-w-0 flex-1 text-xs text-gray-400">
      <span className="font-medium truncate">{displayName}:</span>
      <span className="truncate">
        {message.content.length > 50
          ? `${message.content.slice(0, 50)}...`
          : message.content
        }
      </span>
    </div>
  );
}

function PinnedMessageItem({
  message,
  communityId,
  channelId,
  onNavigateToDMs: _onNavigateToDMs
}: {
  message: NostrEvent;
  communityId: string;
  channelId: string;
  onNavigateToDMs?: (targetPubkey: string) => void;
}) {
  const author = useAuthor(message.pubkey);
  const { mutate: unpinMessage } = useUnpinMessage();
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || genUserName(message.pubkey);
  const profileImage = metadata?.picture;
  const [showUnpinDialog, setShowUnpinDialog] = useState(false);

  const timeAgo = formatDistanceToNowShort(new Date(message.created_at * 1000), { addSuffix: true });

  const handleUnpin = () => {
    setShowUnpinDialog(true);
  };

  const confirmUnpin = () => {
    unpinMessage({ communityId, channelId, messageId: message.id });
    setShowUnpinDialog(false);
  };

  const cancelUnpin = () => {
    setShowUnpinDialog(false);
  };

  return (
    <>
      <div className="flex space-x-2 p-2 rounded bg-gray-800/30 hover:bg-gray-800/50 transition-colors group">
        <Avatar className="w-6 h-6 flex-shrink-0">
          <AvatarImage src={profileImage} alt={displayName} />
          <AvatarFallback className="bg-indigo-600 text-white text-xs">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-white truncate">
              {displayName}
            </span>
            <span className="text-xs text-gray-500 flex-shrink-0">
              {timeAgo}
            </span>
          </div>
          <div className="text-xs text-gray-300 break-words">
            <NoteContent event={message} className="text-xs" onNavigateToDMs={_onNavigateToDMs} />
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="w-6 h-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-700/50"
          onClick={handleUnpin}
          title="Unpin message"
        >
          <X className="w-3 h-3 text-gray-400 hover:text-white" />
        </Button>
      </div>

      <Dialog open={showUnpinDialog} onOpenChange={setShowUnpinDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unpin Message</DialogTitle>
            <DialogDescription>
              Are you sure you want to unpin this message?
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
            <div className="flex items-start space-x-2">
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarImage src={profileImage} alt={displayName} />
                <AvatarFallback className="bg-indigo-600 text-white text-xs">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-sm font-medium text-white truncate">
                    {displayName}
                  </span>
                  <span className="text-sm text-gray-500 flex-shrink-0">
                    {timeAgo}
                  </span>
                </div>
                <div className="text-sm text-gray-300 break-words">
                  <NoteContent event={message} className="text-sm" onNavigateToDMs={_onNavigateToDMs} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelUnpin}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmUnpin}>
              Unpin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}