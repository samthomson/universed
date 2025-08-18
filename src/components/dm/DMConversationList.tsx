import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthor } from "@/hooks/useAuthor";

import { genUserName } from "@/lib/genUserName";
import { formatDistanceToNowShort } from "@/lib/formatTime";
import type { DMConversation } from "@/lib/dmUtils";

interface DMConversationListProps {
  conversations: DMConversation[];
  selectedConversation: string | null;
  onSelectConversation: (conversationId: string) => void;
  searchQuery: string;
  isLoading?: boolean;
  isVirtualized?: boolean;
}

interface ConversationItemProps {
  conversation: DMConversation;
  isSelected: boolean;
  onSelect: () => void;
  searchQuery?: string;
}

function ConversationItem({ conversation, isSelected, onSelect, searchQuery }: ConversationItemProps) {
  const author = useAuthor(conversation.pubkey);
  const metadata = author.data?.metadata;

  const displayName = metadata?.name || genUserName(conversation.pubkey);
  const profileImage = metadata?.picture;
  const lastMessageTime = conversation.lastMessage
    ? new Date(conversation.lastMessage.created_at * 1000)
    : new Date();

  // Get the display content - messages are now pre-decrypted
  const getDisplayContent = () => {
    if (!conversation.lastMessage) return "";
    return conversation.lastMessage.content;
  };

  // Helper function to highlight matching text
  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm || !text) return text;

    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <span key={index} className="bg-yellow-400 text-black px-0.5 rounded">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  return (
    <Button
      variant="ghost"
      className={`flex w-full justify-start p-3 mt-1 h-auto text-left hover:bg-gray-800/60 ${
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
            <span className="font-medium text-white truncate max-w-full">
              {searchQuery && displayName.toLowerCase().includes(searchQuery.toLowerCase()) ? (
                highlightText(displayName, searchQuery)
              ) : (
                displayName
              )}
            </span>
            <div className="flex items-center space-x-1 min-w-[50px] justify-end">
              {conversation.unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                  {conversation.unreadCount}
                </Badge>
              )}
              <span className="text-xs text-gray-400">
                {formatDistanceToNowShort(lastMessageTime, { addSuffix: false })}
              </span>
            </div>
          </div>

            <div className="text-sm text-gray-400 truncate mt-0.5 pr-8">
              {searchQuery && conversation.lastMessage?.content && conversation.lastMessage.content.toLowerCase().includes(searchQuery.toLowerCase()) ? (
                highlightText(getDisplayContent(), searchQuery)
              ) : (
                getDisplayContent()
              )}
            </div>
          </div>
      </div>
    </Button>
  );
}

function ConversationSkeleton() {
  return (
    <div className="w-full p-3">
      <div className="flex items-center space-x-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    </div>
  );
}

export function DMConversationList({
  conversations,
  selectedConversation,
  onSelectConversation,
  searchQuery,
  isLoading = false,
  isVirtualized = false
}: DMConversationListProps) {
  if (isLoading) {
    return (
      <div className="space-y-1 p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <ConversationSkeleton key={i} />
        ))}
      </div>
    );
  }

  // For virtualized mode, we only render the first conversation
  if (isVirtualized && conversations.length === 1) {
    const conversation = conversations[0];
    return (
      <SearchableConversationItem
        key={conversation.id}
        conversation={conversation}
        selectedConversation={selectedConversation}
        onSelectConversation={onSelectConversation}
        searchQuery={searchQuery}
      />
    );
  }

  return (
    <div className="space-y-1 p-2 overflow-y-auto max-h-[calc(100vh-200px)]">
      {conversations.map((conversation) => (
        <SearchableConversationItem
          key={conversation.id}
          conversation={conversation}
          selectedConversation={selectedConversation}
          onSelectConversation={onSelectConversation}
          searchQuery={searchQuery}
        />
      ))}
    </div>
  );
}

// Separate component to handle search filtering with author data
interface SearchableConversationItemProps {
  conversation: DMConversation;
  selectedConversation: string | null;
  onSelectConversation: (conversationId: string) => void;
  searchQuery: string;
}

function SearchableConversationItem({
  conversation,
  selectedConversation,
  onSelectConversation,
  searchQuery
}: SearchableConversationItemProps) {
  const author = useAuthor(conversation.pubkey);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || genUserName(conversation.pubkey);

  // Get content for search - messages are now pre-decrypted
  const searchableContent = conversation.lastMessage?.content;

  // Filter by display name if search query exists
  if (searchQuery) {
    const query = searchQuery.toLowerCase();

    // Check if display name matches
    const nameMatches = displayName.toLowerCase().includes(query);

    // Check if content matches (use searchableContent which handles both encrypted and decrypted)
    const contentMatches = searchableContent && searchableContent.toLowerCase().includes(query);

    // If neither name nor content matches, don't show this conversation
    if (!nameMatches && !contentMatches) {
      return null;
    }
  }

  return (
    <ConversationItem
      conversation={conversation}
      isSelected={selectedConversation === conversation.id}
      onSelect={() => onSelectConversation(conversation.id)}
      searchQuery={searchQuery}
    />
  );
}