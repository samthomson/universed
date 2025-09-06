import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthor } from "@/hooks/useAuthor";
import { useCommunityMembers } from "@/hooks/useCommunityMembers";
import { useUserMetadataSearch } from "@/hooks/useUserMetadataSearch";
import { useUserMetadataBatch } from "@/hooks/useUserMetadataBatch";
import { genUserName } from "@/lib/genUserName";
import { cn } from "@/lib/utils";
import type { NostrMetadata, NostrEvent } from "@nostrify/nostrify";
import { nip19 } from "nostr-tools";

interface SimpleMentionTypeaheadProps {
  open: boolean;
  onClose: () => void;
  query: string;
  onSelect: (npub: string, displayName: string) => void;
  communityId?: string;
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

function MentionItem({ 
  user, 
  onSelect, 
  isHighlighted 
}: {
  user: MentionableUser;
  onSelect: () => void;
  isHighlighted: boolean;
}) {
  const { data: author } = useAuthor(user.pubkey);
  const metadata = author?.metadata || user.metadata;
  
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
      className={cn(
        "flex items-center gap-3 px-3 py-2 cursor-pointer rounded-sm transition-colors",
        isHighlighted
          ? "bg-blue-600/30"
          : "hover:bg-gray-700"
      )}
      onClick={onSelect}
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
          <span className="font-medium text-sm truncate text-foreground">{friendlyName}</span>
          {user.role && (
            <span className={cn("text-xs font-medium", roleColor)}>
              {user.role}
            </span>
          )}
        </div>
        {username !== friendlyName && (
          <div className="text-xs text-muted-foreground truncate">@{username}</div>
        )}
      </div>
    </div>
  );
}

export function SimpleMentionTypeahead({
  open,
  onClose,
  query,
  onSelect,
  communityId,
  rootMessage,
  threadReplies
}: SimpleMentionTypeaheadProps) {
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [mentionableUsers, setMentionableUsers] = useState<MentionableUser[]>([]);
  const { data: communityMembers } = useCommunityMembers(communityId || null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Get pubkeys for batch metadata loading
  const memberPubkeys = communityMembers?.map(m => m.pubkey) || [];
  
  // Also get pubkeys for thread participants
  const threadParticipantPubkeys: string[] = [];
  if (!communityId && (rootMessage || threadReplies)) {
    if (rootMessage) {
      threadParticipantPubkeys.push(rootMessage.pubkey);
    }
    if (threadReplies) {
      threadReplies.forEach(reply => {
        if (!threadParticipantPubkeys.includes(reply.pubkey)) {
          threadParticipantPubkeys.push(reply.pubkey);
        }
      });
    }
  }
  
  const allPubkeys = [...memberPubkeys, ...threadParticipantPubkeys];
  const { data: metadataMap } = useUserMetadataBatch(allPubkeys);
  const { filteredUsers, isLoading } = useUserMetadataSearch(mentionableUsers, query);
  
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
    }

    setMentionableUsers(users);
  }, [communityMembers, metadataMap, communityId, rootMessage, threadReplies]);

  // Reset highlighted index when users change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filteredUsers]);

  // Handle keyboard navigation - this component fully manages its own keyboard events
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!filteredUsers.length) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          setHighlightedIndex(prev => 
            prev < filteredUsers.length - 1 ? prev + 1 : 0
          );
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          setHighlightedIndex(prev => 
            prev > 0 ? prev - 1 : filteredUsers.length - 1
          );
          break;
          
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          e.stopPropagation();
          if (highlightedIndex >= 0 && highlightedIndex < filteredUsers.length) {
            selectUser(filteredUsers[highlightedIndex]);
          } else if (filteredUsers.length > 0) {
            // If no item is highlighted but we have users, select the first one
            selectUser(filteredUsers[0]);
          }
          break;
          
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
      }
    };

    // Use capture phase to ensure we get the event before other handlers
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open, filteredUsers, highlightedIndex, onClose]);

  // Handle clicking outside to close
  useEffect(() => {
    if (!open) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose]);

  // Helper function to select a user
  const selectUser = (user: MentionableUser) => {
    const displayName = user.metadata?.display_name || user.metadata?.name || user.displayName;
    const npub = nip19.npubEncode(user.pubkey);
    onSelect(npub, displayName);
  };

  if (!open) {
    return null;
  }

  return (
    <div 
      ref={containerRef}
      className="absolute bottom-full left-0 mb-2 w-80 z-[9999] bg-popover border border-border rounded-md shadow-lg"
    >
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
          <div className="py-4 text-center text-sm text-muted-foreground">
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
            <div className="text-xs font-medium text-muted-foreground px-2 py-1 mb-1">
              {communityId ? "Community Members" : "Thread Participants"}
            </div>
            {filteredUsers.map((user, index) => (
              <MentionItem
                key={user.pubkey}
                user={user}
                isHighlighted={index === highlightedIndex}
                onSelect={() => selectUser(user)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}