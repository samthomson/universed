import { Pin, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { NoteContent } from "@/components/NoteContent";
import { usePinnedMessageEvents } from "@/hooks/usePinnedMessages";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";
import { useState, useMemo } from "react";
import type { NostrEvent } from "@nostrify/nostrify";

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
    if (messages && messageIds) {
      return messages.filter(message => messageIds.includes(message.id));
    }
    return pinnedMessages || [];
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
              <PinnedMessagePreview message={firstMessage} />
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="w-3 h-3 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
          )}
        </Button>

        {isExpanded && (
          <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
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

function PinnedMessagePreview({ message }: { message: NostrEvent }) {
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
  communityId: _communityId,
  channelId: _channelId,
  onNavigateToDMs: _onNavigateToDMs
}: {
  message: NostrEvent;
  communityId: string;
  channelId: string;
  onNavigateToDMs?: (targetPubkey: string) => void;
}) {
  const author = useAuthor(message.pubkey);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || genUserName(message.pubkey);
  const profileImage = metadata?.picture;

  return (
    <div className="flex space-x-2 p-2 rounded bg-gray-800/30 hover:bg-gray-800/50 transition-colors">
      <Avatar className="w-6 h-6 flex-shrink-0">
        <AvatarImage src={profileImage} alt={displayName} />
        <AvatarFallback className="bg-indigo-600 text-white text-xs">
          {displayName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center space-x-2 mb-1">
          <span className="text-xs font-medium text-white truncate">
            {displayName}
          </span>
        </div>
        <div className="text-xs text-gray-300 break-words">
          <NoteContent event={message} className="text-xs" />
        </div>
      </div>
    </div>
  );
}