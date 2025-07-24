import { useState, useMemo } from "react";
import { Crown, Shield, Users, MoreVertical, UserMinus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCommunityMembers } from "@/hooks/useCommunityMembers";
import { useManageMembers } from "@/hooks/useManageMembers";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCommunities } from "@/hooks/useCommunities";
import { useAuthorBatch } from "@/hooks/useAuthorBatch";
import { genUserName } from "@/lib/genUserName";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/useToast";
import { UserStatusIndicator } from "@/components/user/UserStatusIndicator";
import { UserProfileDialog } from "@/components/profile/UserProfileDialog";
import type { NostrEvent, NostrMetadata } from "@nostrify/nostrify";

interface MemberListProps {
  communityId: string | null;
  channelId?: string | null;
  onNavigateToDMs?: (targetPubkey?: string) => void;
}

interface MemberItemProps {
  pubkey: string;
  role?: 'owner' | 'moderator' | 'member';
  isOnline?: boolean;
  communityId: string;
  canManage?: boolean;
  onMemberClick?: (pubkey: string) => void;
  authorData?: { event?: NostrEvent; metadata?: NostrMetadata };
}

function MemberItem({ pubkey, role = 'member', isOnline: _isOnline = false, communityId, canManage = false, onMemberClick, authorData }: MemberItemProps) {
  const metadata = authorData?.metadata;
  const { removeMember, isRemovingMember } = useManageMembers();
  const { toast } = useToast();

  const displayName = metadata?.name || genUserName(pubkey);
  const profileImage = metadata?.picture;

  const getRoleIcon = () => {
    switch (role) {
      case 'owner':
        return <Crown className="w-3 h-3 text-yellow-500" />;
      case 'moderator':
        return <Shield className="w-3 h-3 text-blue-500" />;
      default:
        return null;
    }
  };

  const getRoleColor = () => {
    switch (role) {
      case 'owner':
        return 'text-yellow-400';
      case 'moderator':
        return 'text-blue-400';
      default:
        return 'text-gray-300';
    }
  };

  const handleRemoveMember = () => {
    removeMember(
      { communityId, memberPubkey: pubkey },
      {
        onSuccess: () => {
          toast({
            title: "Member Removed",
            description: `${displayName} has been removed from the community.`,
          });
        },
        onError: (error) => {
          toast({
            title: "Failed to Remove Member",
            description: error instanceof Error ? error.message : "An error occurred",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div
      className="flex items-center space-x-2 px-2 py-1 hover:bg-gray-600/50 rounded group cursor-pointer"
      onClick={() => onMemberClick?.(pubkey)}
    >
      <div className="relative">
        <Avatar className="w-8 h-8">
          <AvatarImage src={profileImage} alt={displayName} />
          <AvatarFallback className="bg-indigo-600 text-white text-xs">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-0.5 -right-0.5">
          <UserStatusIndicator pubkey={pubkey} />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-1">
          {getRoleIcon()}
          <span className={`text-sm font-medium truncate ${getRoleColor()}`}>
            {displayName}
          </span>
        </div>
      </div>

      {/* Member management dropdown for moderators */}
      {canManage && role === 'member' && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()} // Prevent triggering member click
            >
              <MoreVertical className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation(); // Prevent triggering member click
                handleRemoveMember();
              }}
              disabled={isRemovingMember}
              className="text-red-600 focus:text-red-600"
            >
              <UserMinus className="w-4 h-4 mr-2" />
              Remove Member
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export function MemberList({ communityId, onNavigateToDMs }: MemberListProps) {
  const [selectedMemberPubkey, setSelectedMemberPubkey] = useState<string | null>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);

  const { data: members, isLoading } = useCommunityMembers(communityId);
  const { data: communities } = useCommunities();
  const { user } = useCurrentUser();

  // Extract all member pubkeys for batched author query
  const memberPubkeys = useMemo(() => {
    return members?.map(member => member.pubkey) || [];
  }, [members]);

  // Batch query for all member profiles
  const { data: batchedAuthors, isLoading: isLoadingAuthors } = useAuthorBatch(memberPubkeys);

  // Check if current user can manage members (is owner or moderator)
  const canManageMembers = communityId && user ? (() => {
    const community = communities?.find(c => c.id === communityId);
    if (!community) return false;
    return community.creator === user.pubkey || community.moderators.includes(user.pubkey);
  })() : false;

  const handleMemberClick = (pubkey: string) => {
    setSelectedMemberPubkey(pubkey);
    setShowProfileDialog(true);
  };

  const handleStartDM = (pubkey: string) => {
    // Navigate to DMs and start conversation with this user
    onNavigateToDMs?.(pubkey);
    setShowProfileDialog(false);
  };

  if (!communityId) {
    return (
      <div className="p-4">
        <div className="text-center text-gray-400">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No members to show</p>
        </div>
      </div>
    );
  }

  // Show members list (same for all users, regardless of management capabilities)
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-600 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-300">
            Members {members && `— ${members.length}`}
          </span>
        </div>
      </div>

      {/* Member List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading || isLoadingAuthors ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-2 px-2 py-1">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <Skeleton className="flex-1 h-4" />
                </div>
              ))}
            </div>
          ) : members && members.length > 0 ? (
            <div className="space-y-0.5">
              {/* Online Members */}
              <div className="mb-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 py-1">
                  Online — {members.filter(m => m.isOnline).length}
                </div>
                {members
                  .filter(member => member.isOnline)
                  .map((member) => (
                    <MemberItem
                      key={member.pubkey}
                      pubkey={member.pubkey}
                      role={member.role}
                      isOnline={member.isOnline}
                      communityId={communityId}
                      canManage={canManageMembers}
                      onMemberClick={handleMemberClick}
                      authorData={batchedAuthors?.[member.pubkey]}
                    />
                  ))}
              </div>

              {/* Offline Members */}
              {members.some(m => !m.isOnline) && (
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 py-1">
                    Offline — {members.filter(m => !m.isOnline).length}
                  </div>
                  {members
                    .filter(member => !member.isOnline)
                    .map((member) => (
                      <MemberItem
                        key={member.pubkey}
                        pubkey={member.pubkey}
                        role={member.role}
                        isOnline={member.isOnline}
                        communityId={communityId}
                        canManage={canManageMembers}
                        onMemberClick={handleMemberClick}
                        authorData={batchedAuthors?.[member.pubkey]}
                      />
                    ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No members found</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* User Profile Dialog */}
      <UserProfileDialog
        pubkey={selectedMemberPubkey}
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        onStartDM={handleStartDM}
      />
    </div>
  );
}