import { useState } from "react";
import { MoreHorizontal, Reply, Smile } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmojiPickerComponent } from "@/components/ui/emoji-picker";
import { MessageReactions } from "@/components/chat/MessageReactions";
import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDMDecrypt } from "@/hooks/useDMDecrypt";
import { useEmojiReactions } from "@/hooks/useEmojiReactions";
import { genUserName } from "@/lib/genUserName";
import { formatDistanceToNow } from "date-fns";
import type { NostrEvent } from "@nostrify/nostrify";

interface DMMessageItemProps {
  message: NostrEvent;
  conversationId?: string;
  showAvatar: boolean;
}

export function DMMessageItem({ message, showAvatar }: DMMessageItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { user } = useCurrentUser();
  const author = useAuthor(message.pubkey);
  const metadata = author.data?.metadata;
  const { data: decryptedContent, isLoading: isDecrypting } = useDMDecrypt(message);
  const { addReaction } = useEmojiReactions();

  const displayName = metadata?.name || genUserName(message.pubkey);
  const profileImage = metadata?.picture;
  const timestamp = new Date(message.created_at * 1000);
  const isOwnMessage = user?.pubkey === message.pubkey;

  const handleEmojiSelect = (emoji: string) => {
    if (!user) return;
    addReaction({
      targetEvent: message,
      emoji,
    });
  };

  return (
    <div
      className={`group relative px-4 py-1 hover:bg-gray-800/50 transition-colors ${
        showAvatar ? 'mt-4' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`flex space-x-3 ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
        {/* Avatar */}
        <div className="w-8 flex-shrink-0">
          {showAvatar ? (
            <Avatar className="w-8 h-8">
              <AvatarImage src={profileImage} alt={displayName} />
              <AvatarFallback className="bg-indigo-600 text-white text-xs">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="w-8 h-5 flex items-center justify-center">
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
        <div className={`flex-1 min-w-0 ${isOwnMessage ? 'text-right' : ''}`}>
          {showAvatar && (
            <div className={`flex items-baseline space-x-2 mb-1 ${isOwnMessage ? 'justify-end' : ''}`}>
              <span className="font-medium text-white hover:underline cursor-pointer text-sm">
                {isOwnMessage ? 'You' : displayName}
              </span>
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(timestamp, { addSuffix: true })}
              </span>
            </div>
          )}

          <div className={`inline-block max-w-xs lg:max-w-md xl:max-w-lg ${
            isOwnMessage
              ? 'bg-indigo-600 text-white rounded-l-lg rounded-tr-lg'
              : 'bg-gray-600 text-gray-100 rounded-r-lg rounded-tl-lg'
          } px-3 py-2 break-words`}>
            {isDecrypting ? (
              <div className="animate-pulse">
                <div className="h-4 bg-gray-400 rounded w-3/4 mb-1" />
                <div className="h-4 bg-gray-400 rounded w-1/2" />
              </div>
            ) : decryptedContent ? (
              <span className="text-sm leading-relaxed whitespace-pre-wrap">
                {decryptedContent}
              </span>
            ) : (
              <span className="text-sm text-gray-400 italic">
                Failed to decrypt message
              </span>
            )}
          </div>

          {/* Reactions */}
          <div className={`mt-1 ${isOwnMessage ? 'text-right' : ''}`}>
            <MessageReactions message={message} />
          </div>
        </div>

        {/* Message Actions */}
        {isHovered && !isOwnMessage && (
          <div className="absolute -top-2 right-4 bg-gray-700 border border-gray-600 rounded-md shadow-lg flex">
            <EmojiPickerComponent
              onEmojiSelect={handleEmojiSelect}
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6 hover:bg-gray-600"
                >
                  <Smile className="w-3 h-3" />
                </Button>
              }
              side="top"
              align="end"
            />
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 hover:bg-gray-600"
            >
              <Reply className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 hover:bg-gray-600"
            >
              <MoreHorizontal className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}