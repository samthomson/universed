import { useState, useMemo } from "react";
import { Search, Users, Hash, Plus, Clock, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCommunities } from "@/hooks/useCommunities";
import { useUserMembership } from "@/hooks/useUserMembership";
import { useJoinCommunity } from "@/hooks/useJoinCommunity";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";
import { useToast } from "@/hooks/useToast";
import type { Community } from "@/hooks/useCommunities";
import type { MembershipStatus } from "@/hooks/useUserMembership";

interface CommunityDiscoveryProps {
  onCommunitySelect?: (communityId: string) => void;
}

interface CommunityCardProps {
  community: Community;
  membershipStatus: MembershipStatus;
  onSelect?: (communityId: string) => void;
}

function CommunityCard({ community, membershipStatus, onSelect }: CommunityCardProps) {
  const author = useAuthor(community.creator);
  const metadata = author.data?.metadata;
  const { user } = useCurrentUser();
  const { mutate: joinCommunity, isPending: isJoining } = useJoinCommunity();
  const { toast } = useToast();

  const creatorName = metadata?.name || genUserName(community.creator);
  const memberCount = community.moderators.length + 1; // Creator + moderators (simplified)

  const handleJoinClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!user) {
      toast({
        title: "Login Required",
        description: "You must be logged in to join a community.",
        variant: "destructive",
      });
      return;
    }

    joinCommunity(
      { communityId: community.id, message: `I would like to join ${community.name}` },
      {
        onSuccess: () => {
          toast({
            title: "Join Request Sent",
            description: `Your request to join ${community.name} has been sent to the moderators.`,
          });
        },
        onError: (error) => {
          toast({
            title: "Failed to Send Request",
            description: error instanceof Error ? error.message : "An error occurred",
            variant: "destructive",
          });
        },
      }
    );
  };

  const getActionButton = () => {
    switch (membershipStatus) {
      case 'pending':
        return (
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-yellow-400"
            disabled
          >
            <Clock className="w-4 h-4" />
          </Button>
        );
      case 'approved':
      case 'owner':
      case 'moderator':
        return (
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-green-400"
            disabled
          >
            <CheckCircle className="w-4 h-4" />
          </Button>
        );
      case 'declined':
        return (
          <Badge variant="destructive" className="text-xs">
            Declined
          </Badge>
        );
      case 'banned':
        return (
          <Badge variant="destructive" className="text-xs">
            Banned
          </Badge>
        );
      default:
        return (
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-gray-300 hover:text-white hover:bg-gray-600"
            onClick={handleJoinClick}
            disabled={isJoining}
          >
            <Plus className="w-4 h-4" />
          </Button>
        );
    }
  };

  return (
    <Card className="bg-gray-800/60 border-gray-700 hover:bg-gray-700/80 transition-all duration-200 cursor-pointer overflow-hidden" onClick={() => onSelect?.(community.id)}>
      <CardHeader className="pb-3 overflow-hidden">
        <div className="flex items-start justify-between min-w-0">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            {community.image ? (
              <Avatar className="w-12 h-12 shrink-0">
                <AvatarImage src={community.image} alt={community.name} />
                <AvatarFallback className="bg-gray-600 text-white">
                  {community.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl hover:rounded-xl transition-all duration-200 flex items-center justify-center text-white font-semibold shrink-0">
                {community.name.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className="flex-1 min-w-0 overflow-hidden">
              <CardTitle className="text-lg text-white truncate">
                {community.name}
              </CardTitle>
              <p className="text-sm text-gray-300 truncate">
                by {creatorName}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {getActionButton()}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 overflow-hidden">
        {community.description && (
          <p className="text-sm text-gray-300 mb-3 line-clamp-2">
            {community.description}
          </p>
        )}

        <div className="flex items-center justify-between min-w-0">
          <div className="flex items-center space-x-4 text-sm text-gray-400 min-w-0">
            <div className="flex items-center space-x-1 shrink-0">
              <Users className="w-4 h-4" />
              <span>{memberCount} members</span>
            </div>
            <div className="flex items-center space-x-1 shrink-0">
              <Hash className="w-4 h-4" />
              <span>3 channels</span> {/* Simplified - could be dynamic */}
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {membershipStatus === 'pending' && (
              <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-400">
                Pending
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              Public
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CommunityDiscovery({ onCommunitySelect }: CommunityDiscoveryProps) {
  const [query, setQuery] = useState("");
  const { data: communities, isLoading } = useCommunities();
  const { data: userMemberships } = useUserMembership();
  const { user } = useCurrentUser();

  // Create a map of community membership statuses
  const membershipMap = useMemo(() => {
    const map = new Map<string, MembershipStatus>();

    if (!userMemberships || !user?.pubkey) return map;

    userMemberships.forEach(membership => {
      map.set(membership.communityId, membership.status);
    });

    return map;
  }, [userMemberships, user?.pubkey]);

  // Filter communities based on search query
  const filteredCommunities = useMemo(() => {
    if (!communities) return [];

    // Get membership status for a community
    const getMembershipStatus = (community: Community): MembershipStatus => {
      if (!user?.pubkey) return 'not-member';

      // Check if user is the community creator (owner)
      if (community.creator === user.pubkey) {
        return 'owner';
      }

      // Check if user is a moderator
      if (community.moderators.includes(user.pubkey)) {
        return 'moderator';
      }

      // Check membership status from membership events
      return membershipMap.get(community.id) || 'not-member';
    };

    return communities
      .map(community => ({
        community,
        membershipStatus: getMembershipStatus(community),
      }))
      .filter(({ community }) => {
        if (!query.trim()) return true;

        const searchText = [
          community.name,
          community.description,
        ].filter(Boolean).join(' ').toLowerCase();

        return searchText.includes(query.toLowerCase());
      });
  }, [communities, query, membershipMap, user?.pubkey]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">Discover Communities</h2>
        <p className="text-gray-400">Find and join communities that interest you</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search communities..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 bg-gray-600 border-gray-500 text-gray-100 placeholder:text-gray-400"
        />
      </div>

      {/* Communities Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse bg-gray-800/60 border-gray-700">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gray-600 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-gray-600 rounded w-3/4" />
                    <div className="h-4 bg-gray-600 rounded w-1/2" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-600 rounded w-full" />
                  <div className="h-4 bg-gray-600 rounded w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredCommunities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCommunities.map(({ community, membershipStatus }) => (
            <CommunityCard
              key={community.id}
              community={community}
              membershipStatus={membershipStatus}
              onSelect={onCommunitySelect}
            />
          ))}
        </div>
      ) : (
        <Card className="bg-gray-800/60 border-gray-700">
          <CardContent className="p-8 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-gray-500" />
            <h3 className="text-lg font-semibold mb-2 text-white">No communities found</h3>
            <p className="text-sm text-gray-400">
              {query.trim() ? "Try a different search term" : "No communities available yet"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}