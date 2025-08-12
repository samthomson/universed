import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Users, Store, FolderOpen, Share2, LogOut, Shield } from "lucide-react";
import { useCommunities } from "@/hooks/useCommunities";
import { useCanModerate } from "@/hooks/useCommunityRoles";
import { useLeaveCommunity } from "@/hooks/useLeaveCommunity";
import { useToast } from "@/hooks/useToast";
import { useJoinRequests } from "@/hooks/useJoinRequests";
import { CommunitySettings } from "./CommunitySettings";

import { handleInviteMembers } from "@/lib/communityUtils";
import { cn } from "@/lib/utils";


interface CommunityHeaderProps {
  communityId: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

function RadioTabs({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  const tabs = [
    { id: "channels", label: "Channels", icon: Users, shortLabel: "Chat" },
    { id: "marketplace", label: "Marketplace", icon: Store, shortLabel: "Shop" },
    { id: "resources", label: "Resources", icon: FolderOpen, shortLabel: "Files" },
  ];

  return (
    <div className="relative">
      {/* Hidden radio inputs for tab control */}
      {tabs.map((tab) => (
        <input
          key={tab.id}
          type="radio"
          name="tab-control"
          id={`tab-${tab.id}`}
          checked={activeTab === tab.id}
          onChange={() => onTabChange(tab.id)}
          className="hidden"
        />
      ))}

      {/* Tab list */}
      <ul className="flex flex-row space-x-1 relative z-10">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <li key={tab.id} className="flex-1 text-center relative">
              <label
                htmlFor={`tab-${tab.id}`}
                className={cn(
                  "block cursor-pointer transition-all duration-300 ease-in-out",
                  "px-3 sm:px-4 py-2 text-sm font-medium",
                  "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100",
                  "rounded-lg",
                  isActive && "text-blue-600 dark:text-blue-400"
                )}
              >
                <div className="flex items-center justify-center space-x-1.5 sm:space-x-2">
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline text-xs sm:text-sm">{tab.label}</span>
                  <span className="sm:hidden text-xs">{tab.shortLabel}</span>
                </div>
              </label>

              {/* Individual tab indicator for precise positioning */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full transition-all duration-300 ease-in-out z-20" />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CommunityHeader({ communityId, activeTab, onTabChange }: CommunityHeaderProps) {
  const { data: communities } = useCommunities();
  const { canModerate } = useCanModerate(communityId);
  const { mutate: leaveCommunity, isPending: isLeavingCommunity } = useLeaveCommunity();
  const { toast } = useToast();
  const [showSettings, setShowSettings] = useState(false);

  const { data: joinRequests } = useJoinRequests(communityId);

  const community = communities?.find(c => c.id === communityId);
  const pendingJoinRequests = joinRequests?.length || 0;

  const handleLeaveCommunity = () => {
    if (!community) return;

    leaveCommunity(
      { communityId },
      {
        onSuccess: () => {
          toast({
            title: "Left community",
            description: `You have left ${community.name}`,
          });
          // Navigate away from the community after leaving
          window.location.href = '/communities';
        },
        onError: (error) => {
          toast({
            title: "Failed to leave community",
            description: error.message || "An error occurred while leaving the community",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleDesktopInviteMembers = async () => {
    if (!community) return;

    await handleInviteMembers(community.id, community.relays);
  };

  if (!community) {
    return (
      <div className="h-16 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center px-6">
        <div className="animate-pulse flex items-center space-x-4">
          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-16 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 relative">
      <div className="flex items-center justify-between h-full px-4 sm:px-6">
        {/* Left side: Avatar and Community Name */}
        <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
          {community.image ? (
            <Avatar className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
              <AvatarImage src={community.image} alt={community.name} />
              <AvatarFallback className="text-base sm:text-lg font-semibold">
                {community.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-semibold text-base sm:text-lg flex-shrink-0">
              {community.name.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
              {community.name}
            </h1>
            {community.description && (
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px] sm:max-w-md">
                {community.description}
              </p>
            )}
          </div>
        </div>

        {/* Center: Tab Navigation - Hidden on mobile, shown on desktop */}
        <div className="hidden sm:block absolute left-1/2 transform -translate-x-1/2">
          <div className="w-full max-w-md">
            <RadioTabs activeTab={activeTab} onTabChange={onTabChange} />
          </div>
        </div>

        {/* Right side: Action Buttons */}
        <div className="flex items-center flex-shrink-0 gap-2">
          {/* Moderation Button with Notification Badge */}
          {canModerate && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(true)}
              className="relative flex-shrink-0"
            >
              <Shield className="w-5 h-5" />
              {pendingJoinRequests > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center rounded-full"
                >
                  {pendingJoinRequests}
                </Badge>
              )}
            </Button>
          )}

          {/* Settings Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleDesktopInviteMembers}>
                <Share2 className="w-4 h-4 mr-2" />
                Invite Members
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleLeaveCommunity}
                disabled={isLeavingCommunity}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Leave Community
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Community Settings Dialog */}
      {showSettings && (
        <CommunitySettings
          communityId={communityId}
          open={showSettings}
          onOpenChange={setShowSettings}
        />
      )}


    </div>
  );
}