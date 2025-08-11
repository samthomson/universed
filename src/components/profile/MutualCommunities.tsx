import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMutualCommunities } from "@/hooks/useMutualCommunities";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Link } from "react-router-dom";
import { MoreHorizontal, Info } from "lucide-react";
import { useState } from "react";

interface MutualCommunitiesProps {
  targetPubkey: string;
  onCommunityClick?: (communityId: string) => void;
}

const MAX_DISPLAY_COMMUNITIES = 6;

export function MutualCommunities({ targetPubkey, onCommunityClick }: MutualCommunitiesProps) {
  const { user } = useCurrentUser();
  const { data: mutualCommunities, isLoading, error } = useMutualCommunities(targetPubkey);
  const [showRoleLegend, setShowRoleLegend] = useState(false);

  if (!user || user.pubkey === targetPubkey) {
    return null; // Don't show for own profile
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-400">Communities in Common</h3>
        <div className="flex items-center space-x-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="w-8 h-8 rounded-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-400">Communities in Common</h3>
        <p className="text-xs text-red-400">Failed to load communities</p>
      </div>
    );
  }

  if (!mutualCommunities || mutualCommunities.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-400">Communities in Common</h3>
        <p className="text-xs text-gray-500">No communities in common.</p>
      </div>
    );
  }

  const displayCommunities = mutualCommunities.slice(0, MAX_DISPLAY_COMMUNITIES);
  const hasMore = mutualCommunities.length > MAX_DISPLAY_COMMUNITIES;

  const handleCommunityClick = (communityId: string) => {
    onCommunityClick?.(communityId);
  };

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-medium text-gray-400">
              Communities in Common
              <span className="text-xs text-gray-500 ml-1">({mutualCommunities.length})</span>
            </h3>

            {/* Role legend trigger */}
            <Popover open={showRoleLegend} onOpenChange={setShowRoleLegend}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-4 h-4 hover:bg-gray-700 text-gray-400 hover:text-white"
                  onClick={() => setShowRoleLegend(!showRoleLegend)}
                >
                  <Info className="w-3 h-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-64 p-4 bg-gray-800 border-gray-600 shadow-xl"
                align="end"
                side="top"
              >
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-white">Role Indicators</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500 border border-gray-900"></div>
                      <span className="text-xs text-gray-300">Community Owner</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 border border-gray-900"></div>
                      <span className="text-xs text-gray-300">Community Moderator</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 border border-gray-900"></div>
                      <span className="text-xs text-gray-300">Community Member</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-600">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRoleLegend(false)}
                      className="w-full h-6 text-xs text-gray-400 hover:text-white hover:bg-gray-700"
                    >
                      Got it
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-gray-400 hover:text-gray-300 hover:bg-gray-800"
              asChild
            >
              <Link to={`/communities?mutual=${targetPubkey}`}>
                View all
              </Link>
            </Button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {displayCommunities.map((community) => (
            <Tooltip key={community.id}>
              <TooltipTrigger asChild>
                <Link
                  to={`/c/${community.id}`}
                  onClick={() => handleCommunityClick(community.id)}
                  className="group relative"
                >
                  <Avatar className="w-8 h-8 ring-2 ring-transparent group-hover:ring-indigo-500 transition-all duration-200 cursor-pointer">
                    <AvatarImage
                      src={community.image}
                      alt={community.name}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-indigo-600 text-white text-xs">
                      {community.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* Membership status indicators */}
                  <div className="absolute -bottom-1 -right-1 flex space-x-0.5">
                    {/* Membership indicator (always green for members) */}
                    <div
                      className="w-2 h-2 rounded-full border border-gray-900 bg-green-500"
                      title="Member"
                    />
                    {/* Role-specific indicator (only for owners/moderators) */}
                    {(community.targetUserMembership === 'owner' || community.targetUserMembership === 'moderator') && (
                      <div
                        className={`w-2 h-2 rounded-full border border-gray-900 ${
                          community.targetUserMembership === 'owner'
                            ? 'bg-yellow-500'
                            : 'bg-blue-500'
                        }`}
                        title={community.targetUserMembership === 'owner' ? 'Owner' : 'Moderator'}
                      />
                    )}
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="bg-gray-800 border-gray-600 text-gray-200 max-w-xs"
              >
                <div className="space-y-1">
                  <p className="font-medium text-sm">{community.name}</p>
                  {community.description && (
                    <p className="text-xs text-gray-400 line-clamp-2">
                      {community.description}
                    </p>
                  )}
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-gray-500">You:</span>
                    <span className={`font-medium ${
                      community.currentUserMembership === 'owner'
                        ? 'text-yellow-400'
                        : community.currentUserMembership === 'moderator'
                        ? 'text-blue-400'
                        : 'text-green-400'
                    }`}>
                      {community.currentUserMembership}
                    </span>
                    <span className="text-gray-500">|</span>
                    <span className="text-gray-500">Them:</span>
                    <span className={`font-medium ${
                      community.targetUserMembership === 'owner'
                        ? 'text-yellow-400'
                        : community.targetUserMembership === 'moderator'
                        ? 'text-blue-400'
                        : 'text-green-400'
                    }`}>
                      {community.targetUserMembership}
                    </span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}

          {hasMore && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-8 h-8 p-0 rounded-full text-xs text-gray-400 hover:text-gray-300 hover:bg-gray-800"
                  asChild
                >
                  <Link to={`/communities?mutual=${targetPubkey}`}>
                    <MoreHorizontal className="w-4 h-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="bg-gray-800 border-gray-600 text-gray-200"
              >
                <p className="text-sm">
                  View all {mutualCommunities.length} communities in common
                </p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}