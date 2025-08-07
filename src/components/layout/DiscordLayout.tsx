import { useEffect, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { AppSidebar } from "./AppSidebar";
import { CommunityPanel } from "./CommunityPanel";
import { ChatArea } from "./ChatArea";
import { MemberList } from "./MemberList";
import { UserPanel } from "./UserPanel";
import { SpacesArea } from "@/components/spaces/SpacesArea";
import { CommunityHeader } from "@/components/community/CommunityHeader";
import { JoinRequestDialog } from "@/components/community/JoinRequestDialog";
import { FriendItem } from "@/components/friends/FriendsList";
import { useChannels } from "@/hooks/useChannels";
import { useUrlNavigation } from "@/hooks/useUrlNavigation";
import { useUserCommunityMembership } from "@/hooks/useUserCommunityMembership";
import { useUserCommunities } from "@/hooks/useUserCommunities";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useMessageSystem } from "@/hooks/useMessageSystem";
import { useEnablePerformanceMonitoring } from "@/hooks/usePerformanceMonitor";
import { useMutualFriends } from "@/hooks/useFollowers";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useChannelPreloader } from "@/hooks/useChannelPreloader";
import { useSpacesPreloader } from "@/hooks/useSpacesPreloader";
import { useVisitHistory } from "@/hooks/useVisitHistory";
import { CommunityProvider } from "@/contexts/CommunityContext.tsx";

interface DiscordLayoutProps {
  initialDMTargetPubkey?: string | null;
}

export function DiscordLayout({ initialDMTargetPubkey }: DiscordLayoutProps = {}) {
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(
    null,
  );
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null);
  const [showMemberList, setShowMemberList] = useState(true);
  const [dmTargetPubkey, setDmTargetPubkey] = useState<string | null>(null);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showCommunitySelectionDialog, setShowCommunitySelectionDialog] =
    useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isAutoSelected, setIsAutoSelected] = useState(false);
  const [communityBeforeJoinDialog, setCommunityBeforeJoinDialog] = useState<
    string | null
  >(null);
  const [activeTab, setActiveTab] = useState("channels");

  const { setActiveCommunity } = useMessageSystem();
  useEnablePerformanceMonitoring();
  useEffect(() => {
    setActiveCommunity(selectedCommunity);
  }, [selectedCommunity, setActiveCommunity]);

  const { preloadImmediately: preloadChannelsImmediately } =
    useChannelPreloader();
  const { preloadImmediately: preloadSpacesImmediately } = useSpacesPreloader();

  const { recordCommunityVisit, recordChannelVisit } = useVisitHistory();

  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState<
    "communities" | "channels" | "chat" | "members"
  >("communities");

  const { data: channels } = useChannels(selectedCommunity);
  const { data: userCommunities } = useUserCommunities();
  const { communityId: urlCommunityId, isJoinRequest, clearNavigation } =
    useUrlNavigation();
  const { data: membershipStatus } = useUserCommunityMembership(urlCommunityId);
  const { data: mutualFriends } = useMutualFriends();
  const navigate = useNavigate();

  const handleNavigateToDMs = (targetPubkey?: string) => {
    setSelectedCommunity(null);
    setSelectedChannel(null);
    setSelectedSpace(null);
    if (targetPubkey) {
      setDmTargetPubkey(targetPubkey);
    }
    if (isMobile) {
      setMobileView("chat");
    }
  };

  // Handle initial DM target pubkey from URL
  useEffect(() => {
    if (initialDMTargetPubkey !== undefined) {
      setSelectedCommunity(null);
      setSelectedChannel(null);
      setSelectedSpace(null);
      setDmTargetPubkey(initialDMTargetPubkey);
      if (isMobile) {
        setMobileView("chat");
      }
    }
  }, [initialDMTargetPubkey, isMobile]);

  useEffect(() => {
    if (!hasInitialized && !urlCommunityId && userCommunities !== undefined) {
      setHasInitialized(true);

      if (userCommunities.length > 0) {
        const firstCommunityId = userCommunities[0].id;
        setSelectedCommunity(firstCommunityId);
        setIsAutoSelected(true);

        preloadChannelsImmediately(firstCommunityId);
        preloadSpacesImmediately(firstCommunityId);
      } else {
        setSelectedCommunity(null);
      }
    }
  }, [
    hasInitialized,
    urlCommunityId,
    userCommunities,
    preloadChannelsImmediately,
    preloadSpacesImmediately,
  ]);

  useEffect(() => {
    if (urlCommunityId) {
      if (isJoinRequest) {
        setCommunityBeforeJoinDialog(selectedCommunity);
        setShowJoinDialog(true);
      } else {
        setSelectedCommunity(urlCommunityId);

        if (
          membershipStatus !== "owner" && membershipStatus !== "moderator" &&
          membershipStatus !== "approved" && membershipStatus !== "pending"
        ) {
          setTimeout(() => {
            setCommunityBeforeJoinDialog(selectedCommunity);
            setShowJoinDialog(true);
          }, 500);
        } else if (membershipStatus === "pending") {
          setTimeout(() => {
            clearNavigation();
          }, 500);
        } else {
          clearNavigation();
        }

        preloadChannelsImmediately(urlCommunityId);
        preloadSpacesImmediately(urlCommunityId);
      }
    }
  }, [
    urlCommunityId,
    isJoinRequest,
    membershipStatus,
    clearNavigation,
    preloadChannelsImmediately,
    preloadSpacesImmediately,
    selectedCommunity,
  ]);

  useEffect(() => {
    if (
      selectedCommunity && !selectedSpace && channels && channels.length > 0
    ) {
      const generalChannel = channels.find((channel) =>
        channel.name.toLowerCase() === "general" && channel.type === "text"
      );

      if (generalChannel) {
        setSelectedChannel(generalChannel.id);
      } else {
        const firstTextChannel = channels.find((channel) =>
          channel.type === "text"
        );
        if (firstTextChannel) {
          setSelectedChannel(firstTextChannel.id);
        }
      }

      if (isMobile) {
        setMobileView(isAutoSelected ? "chat" : "channels");
        if (isAutoSelected) {
          setIsAutoSelected(false);
        }
      }
    } else if (!selectedCommunity) {
      setSelectedChannel(null);
      setSelectedSpace(null);

      if (isMobile) {
        setMobileView("communities");
      }
    }
  }, [selectedCommunity, selectedSpace, channels, isMobile, isAutoSelected]);

  const handleJoinSuccess = (communityId: string) => {
    setSelectedCommunity(communityId);
    clearNavigation();
    setCommunityBeforeJoinDialog(null);

    preloadChannelsImmediately(communityId);
    preloadSpacesImmediately(communityId);
  };

  const handleJoinDialogClose = () => {
    setShowJoinDialog(false);
    clearNavigation();
    if (communityBeforeJoinDialog === null && selectedCommunity) {
      setSelectedCommunity(null);
    } else if (communityBeforeJoinDialog !== null) {
      setSelectedCommunity(communityBeforeJoinDialog);
      setCommunityBeforeJoinDialog(null);
    }
  };

  const handleChannelSelect = (channelId: string) => {
    setSelectedChannel(channelId);
    setSelectedSpace(null);
    setActiveTab("channels"); // Ensure we're on channels tab when selecting a channel

    if (selectedCommunity) {
      recordChannelVisit(selectedCommunity, channelId);
    }

    if (isMobile) {
      setMobileView("chat");
    }
  };

  const handleSpaceSelect = (spaceId: string) => {
    setSelectedSpace(spaceId);
    setSelectedChannel(null);

    // Sync active tab with space selection
    if (spaceId === "marketplace") {
      setActiveTab("marketplace");
    } else if (spaceId === "resources") {
      setActiveTab("resources");
    }

    if (isMobile) {
      setMobileView("chat");
    }
  };

  const handleCommunitySelect = (communityId: string | null) => {
    setSelectedCommunity(communityId);
    setIsAutoSelected(false);

    if (communityId) {
      recordCommunityVisit(communityId);
      preloadChannelsImmediately(communityId);
      preloadSpacesImmediately(communityId);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);

    // Update selected space based on tab
    if (tab === "marketplace") {
      setSelectedSpace("marketplace");
      setSelectedChannel(null);
    } else if (tab === "resources") {
      setSelectedSpace("resources");
      setSelectedChannel(null);
    } else if (tab === "channels") {
      setSelectedSpace(null);
      // Keep the current channel or select the first available one
    }
  };

  const handleBackNavigation = () => {
    if (isMobile) {
      if (mobileView === "chat") {
        setMobileView(selectedCommunity ? "channels" : "communities");
      } else if (mobileView === "channels") {
        setMobileView("communities");
      } else if (mobileView === "members") {
        setMobileView("chat");
      }
    }
  };

  if (isMobile) {
    return (
      <>
        <div className="flex flex-col h-screen bg-background text-foreground">
          <div className="flex items-center justify-between p-3 border-b">
            {(mobileView === "chat" || mobileView === "channels" ||
              mobileView === "members") && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackNavigation}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="flex-1 text-center"></div>
            <div className="flex items-center space-x-2"></div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
          {/* Community Header for mobile - positioned at top */}
          {selectedCommunity && mobileView !== "communities" && (
            <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 z-10">
              <CommunityHeader
                communityId={selectedCommunity}
                activeTab={activeTab}
                onTabChange={handleTabChange}
              />
            </div>
          )}

          <div className="flex-1 overflow-hidden">
            {mobileView === "chat"
              ? (
                <>
                  {activeTab === "channels" && (
                    <ChatArea
                      communityId={selectedCommunity}
                      channelId={selectedChannel}
                      onToggleMemberList={() => setMobileView("members")}
                      onNavigateToDMs={handleNavigateToDMs}
                    />
                  )}
                  {activeTab === "marketplace" && selectedCommunity && (
                    <SpacesArea
                      communityId={selectedCommunity}
                      selectedSpace="marketplace"
                    />
                  )}
                  {activeTab === "resources" && selectedCommunity && (
                    <SpacesArea
                      communityId={selectedCommunity}
                      selectedSpace="resources"
                    />
                  )}
                </>
              )
              : mobileView === "channels"
              ? (
                <CommunityPanel
                  communityId={selectedCommunity}
                  selectedChannel={selectedChannel}
                  selectedSpace={selectedSpace}
                  onSelectChannel={handleChannelSelect}
                  onSelectSpace={handleSpaceSelect}
                  onSelectCommunity={handleCommunitySelect}
                  onNavigateToDMs={handleNavigateToDMs}
                />
              )
              : (
                <CommunityPanel
                  communityId={selectedCommunity}
                  selectedChannel={selectedChannel}
                  selectedSpace={selectedSpace}
                  onSelectChannel={handleChannelSelect}
                  onSelectSpace={handleSpaceSelect}
                  onSelectCommunity={handleCommunitySelect}
                  onNavigateToDMs={handleNavigateToDMs}
                />
              )}
          </div>
        </div>
        </div>

        <JoinRequestDialog
          open={showJoinDialog}
          onOpenChange={handleJoinDialogClose}
          onJoinSuccess={handleJoinSuccess}
          communityId={urlCommunityId}
        />
      </>
    );
  }

  return (
    <CommunityProvider currentCommunityId={selectedCommunity}>
      <>
        <div className="flex h-screen bg-background text-foreground">
          <div className="w-16 bg-background/50 flex flex-col h-full">
            <AppSidebar
              selectedCommunity={selectedCommunity}
              showCommunitySelectionDialog={showCommunitySelectionDialog}
              onShowCommunitySelectionDialogChange={setShowCommunitySelectionDialog}
              onSelectCommunity={handleCommunitySelect}
            />
          </div>

          {selectedCommunity
            ? (
              <>
                <div className="flex-1 flex flex-col">
                  {/* Community Header - Full width top bar after sidebar */}
                  <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 z-10">
                    <CommunityHeader
                      communityId={selectedCommunity}
                      activeTab={activeTab}
                      onTabChange={handleTabChange}
                    />
                  </div>

                  <div className="flex flex-1 overflow-hidden">
                    <div className="w-60 bg-secondary/30 flex flex-col">
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

                    <div className="flex-1 flex flex-col">
                      {/* Main Content Area */}
                      <div className="flex-1 flex flex-col">
                        {activeTab === "channels" && (
                          <>
                            {selectedSpace
                              ? (
                                <SpacesArea
                                  communityId={selectedCommunity}
                                  selectedSpace={selectedSpace}
                                />
                              )
                              : (
                                <ChatArea
                                  communityId={selectedCommunity}
                                  channelId={selectedChannel}
                                  onToggleMemberList={() =>
                                    setShowMemberList(!showMemberList)}
                                  onNavigateToDMs={handleNavigateToDMs}
                                />
                              )}
                          </>
                        )}
                        {activeTab === "marketplace" && selectedCommunity && (
                          <SpacesArea
                            communityId={selectedCommunity}
                            selectedSpace="marketplace"
                          />
                        )}
                        {activeTab === "resources" && selectedCommunity && (
                          <SpacesArea
                            communityId={selectedCommunity}
                            selectedSpace="resources"
                          />
                        )}
                      </div>
                    </div>

                    {showMemberList && selectedChannel && !selectedSpace && activeTab === "channels" && (
                      <div className="w-60 bg-secondary/30">
                        <MemberList
                          communityId={selectedCommunity}
                          channelId={selectedChannel}
                          onNavigateToDMs={handleNavigateToDMs}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )
            : (
              <>
                <div className="flex-1 flex flex-col">
                  <CommunityPanel
                    communityId={selectedCommunity}
                    selectedChannel={selectedChannel}
                    onSelectChannel={setSelectedChannel}
                    onSelectCommunity={handleCommunitySelect}
                    dmTargetPubkey={dmTargetPubkey}
                    onDmTargetHandled={() => setDmTargetPubkey(null)}
                    onNavigateToDMs={handleNavigateToDMs}
                  />
                </div>

                <div className="w-60 bg-secondary/30 flex flex-col">
                  <Virtuoso
                    data={mutualFriends || []}
                    itemContent={(index, friend) => (
                      <div className="p-4 pt-0">
                        <FriendItem
                          friend={friend}
                          onMessage={(pubkey) => navigate(`/dm/${pubkey}`)}
                        />
                      </div>
                    )}
                    components={{
                      Header: () => (
                        <div className="p-4">
                          <h3 className="font-semibold text-sm text-muted-foreground mb-3">FRIENDS</h3>
                        </div>
                      ),
                      EmptyPlaceholder: () => (
                        <div className="p-4">
                          <h3 className="font-semibold text-sm text-muted-foreground mb-3">FRIENDS</h3>
                          <p className="text-sm text-muted-foreground">No mutual friends yet</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Friends appear when you follow each other
                          </p>
                        </div>
                      ),
                      Footer: () => <div className="h-2" />,
                    }}
                    className="flex-1 scrollbar-thin"
                  />
                </div>
              </>
            )}
        </div>

        <JoinRequestDialog
          open={showJoinDialog}
          onOpenChange={handleJoinDialogClose}
          onJoinSuccess={handleJoinSuccess}
          communityId={urlCommunityId}
        />
      </>
    </CommunityProvider>
  );
}
