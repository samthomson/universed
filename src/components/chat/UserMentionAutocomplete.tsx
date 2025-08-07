import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthor } from "@/hooks/useAuthor";
import { useCommunityMembers } from "@/hooks/useCommunityMembers";
import { useUserMetadataSearch } from "@/hooks/useUserMetadataSearch";
import { useUserMetadataBatch } from "@/hooks/useUserMetadataBatch";
import { useClickOutside } from "@/hooks/useClickOutside";
import { genUserName } from "@/lib/genUserName";
import { cn } from "@/lib/utils";
import type { NostrMetadata } from "@nostrify/nostrify";
import type * as React from "react";

interface UserMentionAutocompleteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onSelect: (pubkey: string, displayName: string) => void;
  communityId: string;
  triggerRef: React.RefObject<HTMLElement>;
  onKeyDown?: (e: React.KeyboardEvent<Element>) => void;
  selectedIndex?: number;
  onSelectedIndexChange?: (index: number) => void;
  onEnterKey?: (handler: () => boolean) => void;
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

  // Use the most friendly name available for display and selection
  const friendlyName = metadata?.display_name || metadata?.name || user.displayName;
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
      onClick={() => onSelect(user.pubkey, friendlyName)}
      className={cn(
        "flex items-center gap-3 px-3 py-2 cursor-pointer rounded-sm transition-colors",
        isSelected
          ? "bg-blue-600/30"
          : "hover:bg-gray-700"
      )}
    >
      <div className="relative">
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatar} alt={friendlyName} />
          <AvatarFallback className="text-xs">
            {friendlyName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {user.isOnline && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate text-gray-100">{friendlyName}</span>
          {user.role && (
            <span className={cn("text-xs font-medium", roleColor)}>
              {user.role}
            </span>
          )}
        </div>
        {username !== friendlyName && (
          <div className="text-xs text-gray-400 truncate">@{username}</div>
        )}
      </div>
    </div>
  );
}

export function UserMentionAutocomplete({
  open,
  onOpenChange,
  query,
  onSelect,
  communityId,
  triggerRef: _triggerRef,
  onKeyDown: _onKeyDown,
  selectedIndex: externalSelectedIndex,
  onSelectedIndexChange,
  onEnterKey
}: UserMentionAutocompleteProps) {
  const [mentionableUsers, setMentionableUsers] = useState<MentionableUser[]>([]);
  const [internalSelectedIndex, setInternalSelectedIndex] = useState(0);
  const { data: communityMembers } = useCommunityMembers(communityId);

  // Set up click outside handler to close the autocomplete
  const autocompleteRef = useClickOutside<HTMLDivElement>(() => {
    if (open) {
      onOpenChange(false);
    }
  });

  // Get pubkeys for batch metadata loading
  const memberPubkeys = communityMembers?.map(m => m.pubkey) || [];
  const { data: metadataMap } = useUserMetadataBatch(memberPubkeys);

  const { filteredUsers, isLoading } = useUserMetadataSearch(mentionableUsers, query);

  // Use external index if provided, otherwise use internal state
  const selectedIndex = externalSelectedIndex ?? internalSelectedIndex;

  // Handle Enter key selection
  const handleEnterKey = () => {
    // Use filteredUsers for selection, not mentionableUsers
    if (filteredUsers.length > 0 && selectedIndex < filteredUsers.length) {
      const user = filteredUsers[selectedIndex];
      const displayName = user.displayName;
      onSelect(user.pubkey, displayName);
      return true;
    }
    return false;
  };

  // Expose the Enter key handler to parent
  useEffect(() => {
    if (onEnterKey) {
      onEnterKey(handleEnterKey);
    }
  }, [onEnterKey, handleEnterKey, filteredUsers, selectedIndex, onSelect]);

  // Prepare user list with metadata
  useEffect(() => {
    let users: MentionableUser[] = [];

    if (communityMembers && communityMembers.length > 0) {
      // Use real community members with their metadata
      users = communityMembers.map(member => {
        const metadata = metadataMap?.get(member.pubkey);
        return {
          pubkey: member.pubkey,
          displayName: metadata?.display_name || metadata?.name || genUserName(member.pubkey),
          role: member.role,
          isOnline: member.isOnline,
          metadata
        };
      });
    }

    setMentionableUsers(users);
  }, [communityMembers, metadataMap]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const newIndex = Math.min(selectedIndex + 1, filteredUsers.length - 1);
        if (onSelectedIndexChange) {
          onSelectedIndexChange(newIndex);
        } else {
          setInternalSelectedIndex(newIndex);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const newIndex = Math.max(selectedIndex - 1, 0);
        if (onSelectedIndexChange) {
          onSelectedIndexChange(newIndex);
        } else {
          setInternalSelectedIndex(newIndex);
        }
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filteredUsers[selectedIndex]) {
          const user = filteredUsers[selectedIndex];
          const displayName = user.displayName;
          onSelect(user.pubkey, displayName);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, filteredUsers, selectedIndex, onSelect, onSelectedIndexChange, onEnterKey]);

  // Update selected index when users change to prevent out of bounds
  useEffect(() => {
    if (filteredUsers.length > 0) {
      const newIndex = Math.min(selectedIndex, filteredUsers.length - 1);
      if (onSelectedIndexChange) {
        onSelectedIndexChange(newIndex);
      } else {
        setInternalSelectedIndex(newIndex);
      }
    } else {
      if (onSelectedIndexChange) {
        onSelectedIndexChange(0);
      } else {
        setInternalSelectedIndex(0);
      }
    }
  }, [filteredUsers, selectedIndex, onSelectedIndexChange]);

  if (!open) {
    return null;
  }

  return (
    <div ref={autocompleteRef} className="absolute bottom-full left-0 mb-2 w-80 z-50">
      <div className="bg-gray-800 border border-gray-600 rounded-md shadow-lg max-h-64 overflow-y-auto">
        {mentionableUsers.length === 0 ? (
          <div className="py-4 text-center text-sm text-gray-400">
            No community members found
          </div>
        ) : isLoading ? (
          <div className="py-4 text-center text-sm text-gray-400">
            Searching...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-4 text-center text-sm text-gray-400">
            {query ? `No members found matching "${query}"` : "No community members found"}
          </div>
        ) : (
          <div className="p-2">
            <div className="text-xs font-medium text-gray-400 px-2 py-1 mb-1">
              Community Members
            </div>
            {filteredUsers.map((user, index) => (
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