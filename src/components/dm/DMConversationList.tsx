import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";
import { formatDistanceToNow } from "date-fns";
import type { DMConversation } from "@/hooks/useDirectMessages";

interface DMConversationListProps {
  conversations: DMConversation[];
  selectedConversation: string | null;
  onSelectConversation: (conversationId: string) => void;
  searchQuery: string;
}

interface ConversationItemProps {
  conversation: DMConversation;
  isSelected: boolean;
  onSelect: () => void;
}

function ConversationItem({ conversation, isSelected, onSelect }: ConversationItemProps) {
  const author = useAuthor(conversation.pubkey);
  const metadata = author.data?.metadata;

  const displayName = metadata?.name || genUserName(conversation.pubkey);
  const profileImage = metadata?.picture;
  const lastMessageTime = conversation.lastMessage
    ? new Date(conversation.lastMessage.created_at * 1000)
    : new Date();

  return (
    <Button
      variant="ghost"
      className={`w-full justify-start p-3 h-auto text-left hover:bg-gray-800/60 ${
        isSelected ? 'bg-gray-900/80' : ''
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center space-x-3 w-full">
        <div className="relative">
          <Avatar className="w-10 h-10">
            <AvatarImage src={profileImage} alt={displayName} />
            <AvatarFallback className="bg-indigo-600 text-white text-sm">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {/* Online indicator - mock for now */}
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-gray-700 rounded-full" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="font-medium text-white truncate">
              {displayName}
            </span>
            <div className="flex items-center space-x-1">
              {conversation.unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                  {conversation.unreadCount}
                </Badge>
              )}
              <span className="text-xs text-gray-400">
                {formatDistanceToNow(lastMessageTime, { addSuffix: false })}
              </span>
            </div>
          </div>

          <div className="text-sm text-gray-400 truncate mt-0.5">
            {conversation.lastMessage ? (
              <span>Last message...</span> // TODO: Decrypt and show preview
            ) : (
              <span>No messages yet</span>
            )}
          </div>
        </div>
      </div>
    </Button>
  );
}

export function DMConversationList({
  conversations,
  selectedConversation,
  onSelectConversation,
  searchQuery
}: DMConversationListProps) {
  // Filter conversations based on search query
  const filteredConversations = conversations.filter(conversation => {
    if (!searchQuery) return true;

    // TODO: Search by display name when we have author data
    return conversation.pubkey.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (filteredConversations.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400">
        {searchQuery ? (
          <p className="text-sm">No conversations found</p>
        ) : (
          <div>
            <p className="text-sm mb-2">No conversations yet</p>
            <p className="text-xs">Start a new conversation!</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {filteredConversations.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          isSelected={selectedConversation === conversation.id}
          onSelect={() => onSelectConversation(conversation.id)}
        />
      ))}
    </div>
  );
}