import { Plus, MessageCircle, Crown, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUserCommunities } from "@/hooks/useUserCommunities";
import { useHoverPreloader } from "@/hooks/useHoverPreloader";
import { CommunitySelectionDialog } from "@/components/community/CommunitySelectionDialog";
import { useState } from "react";

interface AppSidebarProps {
  selectedCommunity: string | null;
  onSelectCommunity: (communityId: string | null) => void;
}

export function AppSidebar({ selectedCommunity, onSelectCommunity }: AppSidebarProps) {
  const { data: communities } = useUserCommunities();
  const { onCommunityHover, onCommunityHoverEnd } = useHoverPreloader();
  const [showSelectionDialog, setShowSelectionDialog] = useState(false);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* Fixed top section - Direct Messages */}
        <div className="flex flex-col items-center pt-3 pb-2 space-y-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`w-12 h-12 rounded-2xl hover:rounded-xl hover:bg-gray-800/60 transition-all duration-200 ${
                  selectedCommunity === null ? 'bg-gray-900/80' : ''
                }`}
                onClick={() => onSelectCommunity(null)}
              >
                <MessageCircle className="w-6 h-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Direct Messages</p>
            </TooltipContent>
          </Tooltip>

          {/* Separator */}
          <div className="w-8 h-0.5 bg-gray-600 rounded-full" />
        </div>

        {/* Scrollable communities section */}
        <ScrollArea className="flex-1 px-2">
          <div className="flex flex-col items-center space-y-2 pb-2">
            {communities?.map((community) => (
              <Tooltip key={community.id}>
                <TooltipTrigger asChild>
                  <div
                    className="relative"
                    onMouseEnter={() => onCommunityHover(community.id)}
                    onMouseLeave={() => onCommunityHoverEnd(community.id)}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`w-12 h-12 rounded-2xl hover:rounded-xl hover:bg-gray-800/60 transition-all duration-200 ${
                        selectedCommunity === community.id ? 'bg-gray-900/80' : ''
                      }`}
                      onClick={() => onSelectCommunity(community.id)}
                    >
                      {community.image ? (
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={community.image} alt={community.name} />
                          <AvatarFallback>
                            {community.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl hover:rounded-xl transition-all duration-200 flex items-center justify-center text-white font-semibold">
                          {community.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </Button>

                    {/* Membership status indicator */}
                    {community.membershipStatus === 'owner' && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                        <Crown className="w-3 h-3 text-white" />
                      </div>
                    )}
                    {community.membershipStatus === 'moderator' && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <Shield className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="space-y-1">
                    <p>{community.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {community.membershipStatus === 'approved' ? 'Member' : community.membershipStatus}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </ScrollArea>

        {/* Fixed bottom section - Add Community Button */}
        <div className="flex flex-col items-center pt-2 pb-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-12 h-12 rounded-2xl hover:rounded-xl transition-all duration-200 border-2 border-dashed border-gray-600 hover:border-green-500 text-green-500"
                onClick={() => setShowSelectionDialog(true)}
              >
                <Plus className="w-6 h-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Add a Community</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <CommunitySelectionDialog
          open={showSelectionDialog}
          onOpenChange={setShowSelectionDialog}
          onCommunitySelect={onSelectCommunity}
        />
      </div>
    </TooltipProvider>
  );
}