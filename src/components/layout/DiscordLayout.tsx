import { useState, useEffect } from "react";
import { AppSidebar } from "./AppSidebar";
import { CommunityPanel } from "./CommunityPanel";
import { ChatArea } from "./ChatArea";
import { MemberList } from "./MemberList";
import { UserPanel } from "./UserPanel";
import { SpacesArea } from "@/components/spaces/SpacesArea";
import { JoinRequestDialog } from "@/components/community/JoinRequestDialog";
import { useChannels } from "@/hooks/useChannels";
import { useUrlNavigation } from "@/hooks/useUrlNavigation";
import { useUserCommunityMembership } from "@/hooks/useUserCommunityMembership";
import { useUserCommunities } from "@/hooks/useUserCommunities";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useEnableBackgroundLoading } from "@/hooks/useBackgroundLoader";
import { useEnablePerformanceMonitoring } from "@/hooks/usePerformanceMonitor";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Menu, Users } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function DiscordLayout() {
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null);
  const [showMemberList, setShowMemberList] = useState(true);
  const [dmTargetPubkey, setDmTargetPubkey] = useState<string | null>(null);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isAutoSelected, setIsAutoSelected] = useState(false);

  // Enable background loading of community events
  useEnableBackgroundLoading();

  // Enable performance monitoring
  useEnablePerformanceMonitoring();

  // Mobile-specific state
  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState<'communities' | 'channels' | 'chat' | 'members'>('communities');
  const [showCommunitySidebar, setShowCommunitySidebar] = useState(false);
  const [showChannelSidebar, setShowChannelSidebar] = useState(false);

  const { data: channels } = useChannels(selectedCommunity);
  const { data: userCommunities } = useUserCommunities();
  const { communityId: urlCommunityId, isJoinRequest, clearNavigation } = useUrlNavigation();
  const { data: membershipStatus } = useUserCommunityMembership(urlCommunityId);

  const handleNavigateToDMs = (targetPubkey?: string) => {
    setSelectedCommunity(null);
    setSelectedChannel(null);
    setSelectedSpace(null);
    if (targetPubkey) {
      setDmTargetPubkey(targetPubkey);
    }
    // On mobile, navigate to chat view when opening DMs
    if (isMobile) {
      setMobileView('chat');
    }
  };

  // Initialize with first community or DMs
  useEffect(() => {
    // Only initialize once and if there's no URL navigation
    if (!hasInitialized && !urlCommunityId && userCommunities !== undefined) {
      setHasInitialized(true);

      if (userCommunities.length > 0) {
        // User has communities, select the first one
        setSelectedCommunity(userCommunities[0].id);
        setIsAutoSelected(true);
      } else {
        // User has no communities, default to DMs
        setSelectedCommunity(null);
      }
    }
  }, [hasInitialized, urlCommunityId, userCommunities]);

  // Handle URL-based navigation
  useEffect(() => {
    if (urlCommunityId) {
      if (isJoinRequest) {
        // Show join dialog for join requests
        setShowJoinDialog(true);
      } else {
        // For direct community links, check membership and navigate accordingly
        if (membershipStatus === 'owner' || membershipStatus === 'moderator' || membershipStatus === 'approved') {
          // User is a member, select the community
          setSelectedCommunity(urlCommunityId);
          clearNavigation();
        } else {
          // User is not a member, show join dialog
          setShowJoinDialog(true);
        }
      }
    }
  }, [urlCommunityId, isJoinRequest, membershipStatus, clearNavigation]);

  // Auto-select general channel when community is selected (and no space is selected)
  useEffect(() => {
    if (selectedCommunity && !selectedSpace && channels && channels.length > 0) {
      // Look for a channel named "general" first
      const generalChannel = channels.find(channel =>
        channel.name.toLowerCase() === 'general' && channel.type === 'text'
      );

      if (generalChannel) {
        setSelectedChannel(generalChannel.id);
      } else {
        // If no "general" channel, select the first text channel
        const firstTextChannel = channels.find(channel => channel.type === 'text');
        if (firstTextChannel) {
          setSelectedChannel(firstTextChannel.id);
        }
      }

      // On mobile, show appropriate view when community is selected
      if (isMobile) {
        // If this was auto-selected, go directly to chat for smoother UX
        // Otherwise, show channels view so user can see available channels
        setMobileView(isAutoSelected ? 'chat' : 'channels');
        // Reset auto-selected flag after using it
        if (isAutoSelected) {
          setIsAutoSelected(false);
        }
      }
    } else if (!selectedCommunity) {
      // Clear channel and space selection when no community is selected
      setSelectedChannel(null);
      setSelectedSpace(null);

      // On mobile, stay on communities view (don't switch to DMs)
      if (isMobile) {
        setMobileView('communities');
      }
    }
  }, [selectedCommunity, selectedSpace, channels, isMobile, isAutoSelected]);

  const handleJoinSuccess = (communityId: string) => {
    // After successful join, select the community
    setSelectedCommunity(communityId);
    clearNavigation();
  };

  const handleJoinDialogClose = () => {
    setShowJoinDialog(false);
    clearNavigation();
  };

  // Mobile navigation handlers
  const handleChannelSelect = (channelId: string) => {
    setSelectedChannel(channelId);
    setSelectedSpace(null);
    if (isMobile) {
      setMobileView('chat');
      setShowChannelSidebar(false);
    }
  };

  const handleSpaceSelect = (spaceId: string) => {
    setSelectedSpace(spaceId);
    setSelectedChannel(null);
    if (isMobile) {
      setMobileView('chat');
      setShowChannelSidebar(false);
    }
  };

  const handleCommunitySelect = (communityId: string | null) => {
    setSelectedCommunity(communityId);
    setShowCommunitySidebar(false);
    // Reset auto-selected flag when user manually selects a community
    setIsAutoSelected(false);
  };

  const handleBackNavigation = () => {
    if (isMobile) {
      if (mobileView === 'chat') {
        setMobileView(selectedCommunity ? 'channels' : 'communities');
      } else if (mobileView === 'channels') {
        setMobileView('communities');
      } else if (mobileView === 'members') {
        setMobileView('chat');
      }
    }
  };

  if (isMobile) {
    return (
      <>
        <div className="flex flex-col h-screen bg-gray-800 text-gray-100">
          {/* Mobile Header */}
          <div className="flex items-center justify-between p-3 bg-gray-900 border-b border-gray-700 mobile-safe-area">
            {/* Back Button */}
            {(mobileView === 'chat' || mobileView === 'channels' || mobileView === 'members') && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackNavigation}
                className="text-gray-300 hover:text-white mobile-button mobile-touch"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}

            {/* Title */}
            <div className="flex-1 text-center">
              {mobileView === 'communities' && (
                <h1 className="text-lg font-semibold">Communities</h1>
              )}
              {mobileView === 'channels' && selectedCommunity && (
                <h1 className="text-lg font-semibold">Channels</h1>
              )}
              {mobileView === 'chat' && selectedChannel && (
                <h1 className="text-lg font-semibold">#{selectedChannel}</h1>
              )}
              {mobileView === 'chat' && !selectedChannel && !selectedCommunity && (
                <h1 className="text-lg font-semibold">Direct Messages</h1>
              )}
              {mobileView === 'members' && (
                <h1 className="text-lg font-semibold">Members</h1>
              )}
            </div>

            {/* Right Actions */}
            <div className="flex items-center space-x-2">
              {mobileView === 'communities' && (
                <Sheet open={showCommunitySidebar} onOpenChange={setShowCommunitySidebar}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white mobile-button mobile-touch">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-20 p-0 bg-gray-900">
                    <AppSidebar
                      selectedCommunity={selectedCommunity}
                      onSelectCommunity={handleCommunitySelect}
                    />
                  </SheetContent>
                </Sheet>
              )}

              {mobileView === 'channels' && (
                <Sheet open={showChannelSidebar} onOpenChange={setShowChannelSidebar}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white mobile-button mobile-touch">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-80 p-0 bg-gray-700">
                    <div className="flex flex-col h-full">
                      <CommunityPanel
                        communityId={selectedCommunity}
                        selectedChannel={selectedChannel}
                        selectedSpace={selectedSpace}
                        onSelectChannel={handleChannelSelect}
                        onSelectSpace={handleSpaceSelect}
                        onSelectCommunity={handleCommunitySelect}
                        onNavigateToDMs={handleNavigateToDMs}
                      />
                      <UserPanel />
                    </div>
                  </SheetContent>
                </Sheet>
              )}

              {mobileView === 'chat' && selectedChannel && !selectedSpace && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileView('members')}
                  className="text-gray-300 hover:text-white mobile-button mobile-touch"
                >
                  <Users className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>

          {/* Mobile Content */}
          <div className="flex-1 overflow-hidden mobile-viewport">
            {mobileView === 'communities' && (
              <div className="h-full overflow-auto mobile-scroll">
                <CommunityPanel
                  communityId={selectedCommunity}
                  selectedChannel={selectedChannel}
                  selectedSpace={selectedSpace}
                  onSelectChannel={handleChannelSelect}
                  onSelectSpace={handleSpaceSelect}
                  onSelectCommunity={handleCommunitySelect}
                  onNavigateToDMs={handleNavigateToDMs}
                />
              </div>
            )}

            {mobileView === 'channels' && selectedCommunity && (
              <div className="h-full mobile-scroll">
                <CommunityPanel
                  communityId={selectedCommunity}
                  selectedChannel={selectedChannel}
                  selectedSpace={selectedSpace}
                  onSelectChannel={handleChannelSelect}
                  onSelectSpace={handleSpaceSelect}
                  onSelectCommunity={handleCommunitySelect}
                  onNavigateToDMs={handleNavigateToDMs}
                />
              </div>
            )}

            {mobileView === 'chat' && (
              <div className="h-full mobile-scroll">
                {selectedSpace && selectedCommunity ? (
                  <SpacesArea
                    communityId={selectedCommunity}
                    selectedSpace={selectedSpace}
                  />
                ) : (
                  <ChatArea
                    communityId={selectedCommunity}
                    channelId={selectedChannel}
                    onToggleMemberList={() => setMobileView('members')}
                    onNavigateToDMs={handleNavigateToDMs}
                  />
                )}
              </div>
            )}

            {mobileView === 'members' && selectedCommunity && selectedChannel && (
              <div className="h-full mobile-scroll">
                <MemberList
                  communityId={selectedCommunity}
                  channelId={selectedChannel}
                  onNavigateToDMs={handleNavigateToDMs}
                />
              </div>
            )}
          </div>
        </div>

        {/* Join Request Dialog */}
        <JoinRequestDialog
          communityId={urlCommunityId}
          open={showJoinDialog}
          onOpenChange={handleJoinDialogClose}
          onJoinSuccess={handleJoinSuccess}
        />
      </>
    );
  }

  // Desktop Layout (unchanged)
  return (
    <>
      <div className="flex h-screen bg-gray-800 text-gray-100">
        {/* Main Sidebar - Communities and DMs */}
        <div className="w-16 bg-gray-900 flex flex-col h-full">
          <AppSidebar
            selectedCommunity={selectedCommunity}
            onSelectCommunity={(communityId) => {
              setSelectedCommunity(communityId);
              setIsAutoSelected(false);
            }}
          />
        </div>

        {selectedCommunity ? (
          <>
            {/* Community/Channel Sidebar */}
            <div className="w-60 bg-gray-700 flex flex-col">
              <CommunityPanel
                communityId={selectedCommunity}
                selectedChannel={selectedChannel}
                selectedSpace={selectedSpace}
                onSelectChannel={(channelId) => {
                  setSelectedChannel(channelId);
                  setSelectedSpace(null); // Clear space when selecting channel
                }}
                onSelectSpace={(spaceId) => {
                  setSelectedSpace(spaceId);
                  setSelectedChannel(null); // Clear channel when selecting space
                }}
                onSelectCommunity={(communityId) => {
                  setSelectedCommunity(communityId);
                  setIsAutoSelected(false);
                }}
                onNavigateToDMs={handleNavigateToDMs}
              />
              <UserPanel />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col">
              {selectedSpace ? (
                <SpacesArea
                  communityId={selectedCommunity}
                  selectedSpace={selectedSpace}
                />
              ) : (
                <ChatArea
                  communityId={selectedCommunity}
                  channelId={selectedChannel}
                  onToggleMemberList={() => setShowMemberList(!showMemberList)}
                  onNavigateToDMs={handleNavigateToDMs}
                />
              )}
            </div>

            {/* Member List - only show for channels, not spaces */}
            {showMemberList && selectedChannel && !selectedSpace && (
              <div className="w-60 bg-gray-700">
                <MemberList
                  communityId={selectedCommunity}
                  channelId={selectedChannel}
                  onNavigateToDMs={handleNavigateToDMs}
                />
              </div>
            )}
          </>
        ) : (
          <>
            {/* Direct Messages View */}
            <div className="flex-1 flex flex-col">
              <CommunityPanel
                communityId={selectedCommunity}
                selectedChannel={selectedChannel}
                onSelectChannel={setSelectedChannel}
                onSelectCommunity={(communityId) => {
                  setSelectedCommunity(communityId);
                  setIsAutoSelected(false);
                }}
                dmTargetPubkey={dmTargetPubkey}
                onDmTargetHandled={() => setDmTargetPubkey(null)}
                onNavigateToDMs={handleNavigateToDMs}
              />
            </div>

            {/* User Panel at bottom */}
            <div className="w-60 bg-gray-700 flex flex-col justify-end">
              <UserPanel />
            </div>
          </>
        )}
      </div>

      {/* Join Request Dialog */}
      <JoinRequestDialog
        communityId={urlCommunityId}
        open={showJoinDialog}
        onOpenChange={handleJoinDialogClose}
        onJoinSuccess={handleJoinSuccess}
      />
    </>
  );
}