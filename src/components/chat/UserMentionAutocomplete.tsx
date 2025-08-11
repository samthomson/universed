import { useState, useEffect, useCallback, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthor } from "@/hooks/useAuthor";
import { useCommunityMembers } from "@/hooks/useCommunityMembers";
import { useUserMetadataSearch } from "@/hooks/useUserMetadataSearch";
import { useUserMetadataBatch } from "@/hooks/useUserMetadataBatch";
import { useClickOutside } from "@/hooks/useClickOutside";
import { genUserName } from "@/lib/genUserName";
import { cn } from "@/lib/utils";
import type { NostrMetadata, NostrEvent } from "@nostrify/nostrify";
import type * as React from "react";

interface UserMentionAutocompleteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onSelect: (pubkey: string, displayName: string) => void;
  communityId?: string;
  triggerRef: React.RefObject<HTMLElement>;
  onKeyDown?: (e: React.KeyboardEvent<Element>) => void;
  selectedIndex?: number;
  onSelectedIndexChange?: (index: number) => void;
  onEnterKey?: (handler: () => boolean) => void;
  // Thread context props
  rootMessage?: NostrEvent;
  threadReplies?: NostrEvent[];
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
  onEnterKey,
  rootMessage,
  threadReplies
}: UserMentionAutocompleteProps) {
  const [mentionableUsers, setMentionableUsers] = useState<MentionableUser[]>([]);
  const [internalSelectedIndex, setInternalSelectedIndex] = useState(-1); // Start with no selection
  const { data: communityMembers } = useCommunityMembers(communityId || null);

  // Set up click outside handler to close the autocomplete
  const autocompleteRef = useClickOutside<HTMLDivElement>(() => {
    if (open) {
      onOpenChange(false);
    }
  });

  // Get pubkeys for batch metadata loading
  const memberPubkeys = useMemo(() => {
    return communityMembers?.map(m => m.pubkey) || [];
  }, [communityMembers]);

  // Also get pubkeys for thread participants
  const threadParticipantPubkeys = useMemo(() => {
    if (!communityId && (rootMessage || threadReplies)) {
      const pubkeys = new Set<string>();
      if (rootMessage) {
        pubkeys.add(rootMessage.pubkey);
      }
      if (threadReplies) {
        threadReplies.forEach(reply => pubkeys.add(reply.pubkey));
      }
      return Array.from(pubkeys);
    }
    return [];
  }, [communityId, rootMessage, threadReplies]);

  const allPubkeys = useMemo(() => {
    return [...memberPubkeys, ...threadParticipantPubkeys];
  }, [memberPubkeys, threadParticipantPubkeys]);

  const { data: metadataMap } = useUserMetadataBatch(allPubkeys);

  const { filteredUsers, isLoading } = useUserMetadataSearch(mentionableUsers, query);

  // Use external index if provided, otherwise use internal state
  const selectedIndex = externalSelectedIndex ?? internalSelectedIndex;

  // Handle Enter key selection
  const handleEnterKey = useCallback(() => {
    // Use filteredUsers for selection, not mentionableUsers
    // Only select if there's a valid selection (selectedIndex >= 0)
    if (filteredUsers.length > 0 && selectedIndex >= 0 && selectedIndex < filteredUsers.length) {
      const user = filteredUsers[selectedIndex];
      const displayName = user.displayName;
      onSelect(user.pubkey, displayName);
      return true;
    }
    return false;
  }, [filteredUsers, selectedIndex, onSelect]);

  // Expose the Enter key handler to parent
  useEffect(() => {
    if (onEnterKey) {
      onEnterKey(handleEnterKey);
    }
  }, [onEnterKey, handleEnterKey]);

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
    } else if (!communityId && (rootMessage || threadReplies)) {
      // Thread context - show root message author and thread participants
      const uniquePubkeys = new Set<string>();

      // Add root message author
      if (rootMessage) {
        uniquePubkeys.add(rootMessage.pubkey);
      }

      // Add thread reply authors
      if (threadReplies) {
        threadReplies.forEach(reply => {
          uniquePubkeys.add(reply.pubkey);
        });
      }

      // Convert to MentionableUser format with metadata
      users = Array.from(uniquePubkeys).map(pubkey => {
        const metadata = metadataMap?.get(pubkey);
        return {
          pubkey,
          displayName: metadata?.display_name || metadata?.name || genUserName(pubkey),
          role: undefined,
          isOnline: undefined,
          metadata
        };
      });
    } else if (!communityId) {
      // No context available - empty list
      users = [];
    }

    setMentionableUsers(users);
  }, [communityMembers, metadataMap, communityId, rootMessage, threadReplies]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        // If no selection, select first item, otherwise move down
        const newIndex = selectedIndex < 0 ? 0 : Math.min(selectedIndex + 1, filteredUsers.length - 1);
        if (onSelectedIndexChange) {
          onSelectedIndexChange(newIndex);
        } else {
          setInternalSelectedIndex(newIndex);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        // If at first item or no selection, move to last item, otherwise move up
        const newIndex = selectedIndex <= 0 ? Math.max(filteredUsers.length - 1, 0) : selectedIndex - 1;
        if (onSelectedIndexChange) {
          onSelectedIndexChange(newIndex);
        } else {
          setInternalSelectedIndex(newIndex);
        }
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        // Only select if there's a valid selection
        if (selectedIndex >= 0 && filteredUsers[selectedIndex]) {
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
      // If no selection or selection is out of bounds, don't auto-select
      if (selectedIndex < 0 || selectedIndex >= filteredUsers.length) {
        // Keep no selection (-1) instead of auto-selecting first item
        if (onSelectedIndexChange) {
          onSelectedIndexChange(-1);
        } else {
          setInternalSelectedIndex(-1);
        }
      }
    } else {
      // No users available, reset to no selection
      if (onSelectedIndexChange) {
        onSelectedIndexChange(-1);
      } else {
        setInternalSelectedIndex(-1);
      }
    }
  }, [filteredUsers, selectedIndex, onSelectedIndexChange]);

  if (!open) {
    return null;
  }

  return (
    <div ref={autocompleteRef} className="absolute bottom-full left-0 mb-2 w-80 z-[9999] bg-popover border border-border rounded-md shadow-lg">
      <div className="max-h-64 overflow-y-auto">
        {mentionableUsers.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            {communityId
              ? "No community members found"
              : (rootMessage || threadReplies)
                ? "No thread participants found"
                : "Start typing to search for users..."
            }
          </div>
        ) : isLoading ? (
          <div className="py-4 text-center text-sm text-gray-400">
            Searching...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            {query
              ? `No users found matching "${query}"`
              : (communityId
                  ? "No community members found"
                  : "No thread participants found")
            }
          </div>
        ) : (
          <div className="p-2">
            <div className="text-xs font-medium text-gray-400 px-2 py-1 mb-1">
              {communityId ? "Community Members" : "Thread Participants"}
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