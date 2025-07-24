import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthor } from "@/hooks/useAuthor";
import { useCommunityMembers } from "@/hooks/useCommunityMembers";
import { genUserName } from "@/lib/genUserName";
import { cn } from "@/lib/utils";
import type { NostrMetadata } from "@nostrify/nostrify";

interface UserMentionAutocompleteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onSelect: (pubkey: string, displayName: string) => void;
  communityId: string;
  triggerRef: React.RefObject<HTMLElement>;
  onKeyDown?: (e: KeyboardEvent) => void;
}

interface MentionableUser {
  pubkey: string;
  displayName: string;
  metadata?: NostrMetadata;
  role?: 'owner' | 'moderator' | 'member';
  isOnline?: boolean;
}

function UserMentionItem({ user, onSelect, isSelected }: {
  user: MentionableUser;
  onSelect: (pubkey: string, displayName: string) => void;
  isSelected?: boolean;
}) {
  const { data: author } = useAuthor(user.pubkey);
  const metadata = author?.metadata || user.metadata;

  const displayName = metadata?.display_name || metadata?.name || user.displayName;
  const username = metadata?.name || genUserName(user.pubkey);
  const avatar = metadata?.picture;

  const roleColors = {
    owner: "text-yellow-400",
    moderator: "text-blue-400",
    member: "text-gray-400"
  };

  const roleColor = user.role ? roleColors[user.role] : "text-gray-400";

  return (
    <div
      onClick={() => onSelect(user.pubkey, displayName)}
      className={cn(
        "flex items-center gap-3 px-3 py-2 cursor-pointer rounded-sm transition-colors",
        isSelected
          ? "bg-blue-600/30"
          : "hover:bg-gray-700"
      )}
    >
      <div className="relative">
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatar} alt={displayName} />
          <AvatarFallback className="text-xs">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {user.isOnline && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate text-gray-100">{displayName}</span>
          {user.role && (
            <span className={cn("text-xs font-medium", roleColor)}>
              {user.role}
            </span>
          )}
        </div>
        {username !== displayName && (
          <div className="text-xs text-gray-400 truncate">@{username}</div>
        )}
      </div>
    </div>
  );
}

export function UserMentionAutocomplete({
  open,
  onOpenChange: _onOpenChange,
  query,
  onSelect,
  communityId,
  triggerRef: _triggerRef,
  onKeyDown: _onKeyDown
}: UserMentionAutocompleteProps) {
  const [mentionableUsers, setMentionableUsers] = useState<MentionableUser[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { data: communityMembers } = useCommunityMembers(communityId);

  // Filter and prepare mentionable users
  useEffect(() => {
    // For demo purposes, create some mock users if no community members are available
    const mockUsers: MentionableUser[] = [
      {
        pubkey: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        displayName: "Alice",
        role: "owner",
        isOnline: true
      },
      {
        pubkey: "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
        displayName: "Bob",
        role: "moderator",
        isOnline: false
      },
      {
        pubkey: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        displayName: "Charlie",
        role: "member",
        isOnline: true
      }
    ];

    let users: MentionableUser[] = [];

    if (communityMembers && communityMembers.length > 0) {
      // Use real community members if available
      users = communityMembers.map(member => ({
        pubkey: member.pubkey,
        displayName: genUserName(member.pubkey), // Fallback, will be replaced by metadata
        role: member.role,
        isOnline: member.isOnline
      }));
    } else {
      // Use mock users for demo/testing
      users = mockUsers;
    }

    // Filter by query if provided
    if (query.trim()) {
      const filteredUsers = users.filter(user => {
        const searchText = user.displayName.toLowerCase();
        return searchText.includes(query.toLowerCase());
      });
      setMentionableUsers(filteredUsers.slice(0, 10)); // Limit to 10 results
    } else {
      setMentionableUsers(users.slice(0, 10)); // Show first 10 members when no query
    }

    // Reset selected index when users change
    setSelectedIndex(0);
  }, [communityMembers, query]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, mentionableUsers.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (mentionableUsers[selectedIndex]) {
          const user = mentionableUsers[selectedIndex];
          const displayName = user.displayName;
          onSelect(user.pubkey, displayName);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, mentionableUsers, selectedIndex, onSelect]);

  if (!open) {
    return null;
  }

  return (
    <div className="absolute bottom-full left-0 mb-2 w-80 z-50">
      <div className="bg-gray-800 border border-gray-600 rounded-md shadow-lg max-h-64 overflow-y-auto">
        {mentionableUsers.length === 0 ? (
          <div className="py-4 text-center text-sm text-gray-400">
            {query ? `No members found matching "${query}"` : "No community members found"}
          </div>
        ) : (
          <div className="p-2">
            <div className="text-xs font-medium text-gray-400 px-2 py-1 mb-1">
              Community Members
            </div>
            {mentionableUsers.map((user, index) => (
              <UserMentionItem
                key={user.pubkey}
                user={user}
                onSelect={onSelect}
                isSelected={index === selectedIndex}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}