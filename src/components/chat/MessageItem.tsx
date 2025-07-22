import { useState } from "react";
import { MoreHorizontal, Reply, Smile, Pin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { NoteContent } from "@/components/NoteContent";
import { MessageReactions } from "./MessageReactions";
import { MessageThread } from "./MessageThread";
import { useAuthor } from "@/hooks/useAuthor";
import { useAddReaction } from "@/hooks/useAddReaction";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useThreadReplies } from "@/hooks/useThreadReplies";
import { genUserName } from "@/lib/genUserName";
import { formatDistanceToNow } from "date-fns";
import type { NostrEvent } from "@nostrify/nostrify";

interface MessageItemProps {
  message: NostrEvent;
  showAvatar: boolean;
}

export function MessageItem({ message, showAvatar }: MessageItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const author = useAuthor(message.pubkey);
  const metadata = author.data?.metadata;
  const { mutate: addReaction } = useAddReaction();
  const { user } = useCurrentUser();
  const { data: replies } = useThreadReplies(message.id);

  const displayName = metadata?.name || genUserName(message.pubkey);
  const profileImage = metadata?.picture;
  const timestamp = new Date(message.created_at * 1000);

  const handleQuickReaction = (emoji: string) => {
    if (!user) return;
    addReaction({
      targetEvent: message,
      emoji,
    });
  };

  const replyCount = replies?.length || 0;

  return (
    <div
      className={`group relative px-4 py-1 hover:bg-gray-800/50 transition-colors ${
        showAvatar ? 'mt-4' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex space-x-3">
        {/* Avatar */}
        <div className="w-10 flex-shrink-0">
          {showAvatar ? (
            <Avatar className="w-10 h-10">
              <AvatarImage src={profileImage} alt={displayName} />
              <AvatarFallback className="bg-indigo-600 text-white text-sm">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
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
              <span className="font-semibold text-white hover:underline cursor-pointer">
                {displayName}
              </span>
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
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 hover:bg-gray-600"
              onClick={() => handleQuickReaction("👍")}
            >
              <Smile className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 hover:bg-gray-600"
              onClick={() => setShowThread(true)}
            >
              <Reply className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 hover:bg-gray-600"
            >
              <Pin className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 hover:bg-gray-600"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Thread Sheet */}
      <MessageThread
        rootMessage={message}
        open={showThread}
        onOpenChange={setShowThread}
      />
    </div>
  );
}