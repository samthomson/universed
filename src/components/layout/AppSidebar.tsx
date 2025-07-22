import { Plus, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCommunities } from "@/hooks/useCommunities";
import { CreateCommunityDialog } from "@/components/community/CreateCommunityDialog";
import { useState } from "react";

interface AppSidebarProps {
  selectedCommunity: string | null;
  onSelectCommunity: (communityId: string | null) => void;
}

export function AppSidebar({ selectedCommunity, onSelectCommunity }: AppSidebarProps) {
  const { data: communities } = useCommunities();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <TooltipProvider>
      <div className="flex flex-col items-center py-3 space-y-2">
        {/* Direct Messages */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={selectedCommunity === null ? "secondary" : "ghost"}
              size="icon"
              className="w-12 h-12 rounded-2xl hover:rounded-xl transition-all duration-200"
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

        {/* Communities */}
        {communities?.map((community) => (
          <Tooltip key={community.id}>
            <TooltipTrigger asChild>
              <Button
                variant={selectedCommunity === community.id ? "secondary" : "ghost"}
                size="icon"
                className="w-12 h-12 rounded-2xl hover:rounded-xl transition-all duration-200"
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
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{community.name}</p>
            </TooltipContent>
          </Tooltip>
        ))}

        {/* Add Community Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-12 h-12 rounded-2xl hover:rounded-xl transition-all duration-200 border-2 border-dashed border-gray-600 hover:border-green-500 text-green-500"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="w-6 h-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Add a Community</p>
          </TooltipContent>
        </Tooltip>

        <CreateCommunityDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
        />
      </div>
    </TooltipProvider>
  );
}