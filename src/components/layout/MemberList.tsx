import { Crown, Shield, Users, MoreVertical, UserMinus, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCommunityMembers } from "@/hooks/useCommunityMembers";
import { useJoinRequests } from "@/hooks/useJoinRequests";
import { useManageMembers } from "@/hooks/useManageMembers";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCommunities } from "@/hooks/useCommunities";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/useToast";
import { JoinRequestsPanel } from "@/components/community/JoinRequestsPanel";

interface MemberListProps {
  communityId: string | null;
  channelId?: string | null;
}

interface MemberItemProps {
  pubkey: string;
  role?: 'owner' | 'moderator' | 'member';
  isOnline?: boolean;
  communityId: string;
  canManage?: boolean;
}

function MemberItem({ pubkey, role = 'member', isOnline = false, communityId, canManage = false }: MemberItemProps) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
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
    <div className="flex items-center space-x-2 px-2 py-1 hover:bg-gray-600/50 rounded group">
      <div className="relative">
        <Avatar className="w-8 h-8">
          <AvatarImage src={profileImage} alt={displayName} />
          <AvatarFallback className="bg-indigo-600 text-white text-xs">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {isOnline && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-gray-700 rounded-full" />
        )}
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
            >
              <MoreVertical className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={handleRemoveMember}
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

export function MemberList({ communityId }: MemberListProps) {
  const { data: members, isLoading } = useCommunityMembers(communityId);
  const { data: joinRequests } = useJoinRequests(communityId);
  const { data: communities } = useCommunities();
  const { user } = useCurrentUser();

  // Check if current user can manage members (is owner or moderator)
  const canManageMembers = communityId && user ? (() => {
    const community = communities?.find(c => c.id === communityId);
    if (!community) return false;
    return community.creator === user.pubkey || community.moderators.includes(user.pubkey);
  })() : false;

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

  // If user can manage members and there are join requests, show tabs
  if (canManageMembers) {
    return (
      <div className="flex flex-col h-full">
        <Tabs defaultValue="members" className="flex flex-col h-full">
          <div className="p-4 border-b border-gray-600 flex-shrink-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="members" className="text-xs">
                <Users className="w-3 h-3 mr-1" />
                Members
                {members && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {members.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="requests" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                Requests
                {joinRequests && joinRequests.length > 0 && (
                  <Badge variant="destructive" className="ml-1 text-xs">
                    {joinRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="members" className="flex-1 mt-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2">
                {isLoading ? (
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
          </TabsContent>

          <TabsContent value="requests" className="flex-1 mt-0 overflow-hidden">
            <JoinRequestsPanel communityId={communityId} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Regular member view (no management capabilities)
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
          {isLoading ? (
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
    </div>
  );
}