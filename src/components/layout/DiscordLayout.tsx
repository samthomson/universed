import { useEffect, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { AppSidebar } from "./AppSidebar";
import { CommunityPanel } from "./CommunityPanel";
import { ChatArea } from "./ChatArea";
import { MemberList } from "./MemberList";
import { UserPanel } from "./UserPanel";
import { DirectMessages } from "@/components/dm/DirectMessages";
import { SpacesArea } from "@/components/spaces/SpacesArea";
import { CommunityHeader } from "@/components/community/CommunityHeader";
import { JoinRequestDialog } from "@/components/community/JoinRequestDialog";
import { FriendItem } from "@/components/friends/FriendsList";
import { MobileChannelHeader } from "@/components/layout/MobileChannelHeader";
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
import { ArrowLeft, MessageCircle, Store, FolderOpen, MoreHorizontal, LogOut, Share2 } from "lucide-react";
import { useChannelPreloader } from "@/hooks/useChannelPreloader";
import { useSpacesPreloader } from "@/hooks/useSpacesPreloader";
import { useVisitHistory } from "@/hooks/useVisitHistory";
import { CommunityProvider } from "@/contexts/CommunityContext.tsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCommunities } from "@/hooks/useCommunities";
import { useLeaveCommunity } from "@/hooks/useLeaveCommunity";
import { useToast } from "@/hooks/useToast";
import { nip19 } from "nostr-tools";

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
  const [selectedDMConversation, setSelectedDMConversation] = useState<string | null>(null);
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

  // Hooks for mobile channel menu
  const { data: communities } = useCommunities();
  const { mutate: leaveCommunity, isPending: isLeavingCommunity } = useLeaveCommunity();
  const { toast } = useToast();

  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState<
    "communities" | "channels" | "chat" | "members"
  >("communities");

  // Initialize mobile view based on community and DM selection
  useEffect(() => {
    if (isMobile) {
      if (selectedCommunity) {
        setMobileView("channels");
      } else {
        setMobileView("chat"); // DM list view or conversation
      }
    }
  }, [isMobile, selectedCommunity]);

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
    setActiveTab("channels"); // Reset to channels tab to avoid confusion
    if (targetPubkey) {
      setDmTargetPubkey(targetPubkey);
      setSelectedDMConversation(targetPubkey);
    } else {
      setSelectedDMConversation(null);
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
      setSelectedDMConversation(initialDMTargetPubkey);
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
        setMobileView("channels");
        setIsAutoSelected(false);
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
      if (!selectedCommunity && selectedDMConversation) {
        // DM conversation: go back to DM list
        setSelectedDMConversation(null);
        setDmTargetPubkey(null);
      } else if (selectedCommunity && mobileView === "chat") {
        // Community chat: go back to channels
        setMobileView("channels");
      } else if (selectedCommunity && mobileView === "members") {
        // Community members: go back to chat
        setMobileView("chat");
      } else if (selectedCommunity && mobileView === "channels") {
        // Community channels: go back to no community (DM list)
        setSelectedCommunity(null);
        setMobileView("chat");
      }
    }
  };

  // Mobile channel menu functions
  const handleInviteMembers = async () => {
    if (!selectedCommunity) return;

    const community = communities?.find((c) => c.id === selectedCommunity);
    if (!community) return;

    try {
      // Parse community ID to get the components for naddr
      const [kind, pubkey, identifier] = community.id.split(':');

      // Generate naddr for the community
      const naddr = nip19.naddrEncode({
        kind: parseInt(kind),
        pubkey,
        identifier,
        relays: community.relays.length > 0 ? community.relays : undefined,
      });

      // Generate shareable join URL
      const baseUrl = window.location.origin;
      const joinUrl = `${baseUrl}/join/${naddr}`;

      await navigator.clipboard.writeText(joinUrl);
      toast({
        title: "Invite link copied",
        description: "The community invite link has been copied to your clipboard.",
      });
    } catch {
      toast({
        title: "Failed to copy link",
        description: "Could not copy invite link to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleLeaveCommunity = () => {
    if (!selectedCommunity) return;

    const community = communities?.find((c) => c.id === selectedCommunity);
    if (!community) return;

    leaveCommunity(
      { communityId: selectedCommunity },
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

  if (isMobile) {
    // Show sidebar when:
    // 1. In channels view with a community selected, OR
    // 2. In DM list view (no community selected, no active DM conversation)
    // Hide sidebar when in an active DM conversation
    const showSidebar = (mobileView === "channels" && selectedCommunity) || (!selectedCommunity && !selectedDMConversation);

    return (
      <>
        <div className="flex h-screen bg-background text-foreground">
          {/* Left Sidebar - only show in channels view or when no community selected */}
          {showSidebar && (
            <div className="w-16 bg-background/50 flex flex-col h-full border-r">
              <AppSidebar
                selectedCommunity={selectedCommunity}
                showCommunitySelectionDialog={showCommunitySelectionDialog}
                onShowCommunitySelectionDialogChange={setShowCommunitySelectionDialog}
                onSelectCommunity={handleCommunitySelect}
              />
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Mobile Top Navigation Bar - only show when needed */}
            {((!selectedCommunity && dmTargetPubkey) ||
              (selectedCommunity && (mobileView === "chat" || mobileView === "members")) ||
              (mobileView === "chat" && selectedCommunity) ||
              (mobileView === "members")) && (
              <div className="flex items-center justify-between p-3 border-b bg-background z-20 flex-shrink-0">
                {/* Back button - show for DM conversations or community chat/members */}
                {(!selectedCommunity && dmTargetPubkey) || (selectedCommunity && (mobileView === "chat" || mobileView === "members")) ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBackNavigation}
                    className="flex-shrink-0"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                ) : (
                  <div className="flex-shrink-0 w-9"></div>
                )}

                {/* Center content - Minimal titles, no title for DM conversations */}
                <div className="flex-1 text-center min-w-0">
                  {mobileView === "chat" && selectedCommunity && (
                    <>
                      {activeTab === "channels" ? (
                        <MobileChannelHeader
                          communityId={selectedCommunity}
                          channelId={selectedChannel}
                          onNavigateToDMs={handleNavigateToDMs}
                        />
                      ) : (
                        <h2 className="font-semibold text-lg truncate w-full">
                          {activeTab === "marketplace" ? "Shop" :
                           activeTab === "resources" ? "Files" : "Chat"}
                        </h2>
                      )}
                    </>
                  )}
                  {mobileView === "members" && (
                    <h2 className="font-semibold text-lg truncate">Members</h2>
                  )}
                </div>

                {/* Triple Dot Menu - only show for community chat with channels tab */}
                {mobileView === "chat" && selectedCommunity && activeTab === "channels" ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="flex-shrink-0">
                        <MoreHorizontal className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={handleInviteMembers}>
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
                ) : (
                  <div className="flex-shrink-0 w-9"></div>
                )}
              </div>
            )}

            {/* Mobile Tab Navigation - only show in chat view with Lucide icons */}
            {selectedCommunity && mobileView === "chat" && (
              <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 z-10 flex-shrink-0">
                <div className="px-2 py-1">
                  <div className="relative">
                    {/* Hidden radio inputs for tab control */}
                    {["channels", "marketplace", "resources"].map((tabId) => (
                      <input
                        key={tabId}
                        type="radio"
                        name="mobile-tab-control"
                        id={`mobile-tab-${tabId}`}
                        checked={activeTab === tabId}
                        onChange={() => handleTabChange(tabId)}
                        className="hidden"
                      />
                    ))}

                    {/* Tab list - compact with Lucide icons */}
                    <ul className="flex flex-row relative z-10 min-w-0">
                      {[
                        { id: "channels", label: "Chat", icon: MessageCircle },
                        { id: "marketplace", label: "Shop", icon: Store },
                        { id: "resources", label: "Files", icon: FolderOpen },
                      ].map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;

                        return (
                          <li key={tab.id} className="flex-1 text-center min-w-0">
                            <label
                              htmlFor={`mobile-tab-${tab.id}`}
                              className={`block cursor-pointer transition-all duration-300 ease-in-out py-2 rounded-md ${
                                isActive
                                  ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                              }`}
                            >
                              <div className="flex flex-col items-center">
                                <Icon className="w-4 h-4 flex-shrink-0" />
                                <span className="text-xs mt-1 truncate">{tab.label}</span>
                              </div>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden min-w-0">
              {!selectedCommunity ? (
                // Direct Messages - now controlled by parent state
                <DirectMessages
                  targetPubkey={dmTargetPubkey}
                  selectedConversation={selectedDMConversation}
                  onTargetHandled={() => {
                    setDmTargetPubkey(null);
                    setSelectedDMConversation(null);
                  }}
                  onNavigateToDMs={(pubkey) => {
                    handleNavigateToDMs(pubkey);
                  }}
                  onConversationSelect={setSelectedDMConversation}
                />
              ) : mobileView === "chat"
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
                        onNavigateToDMs={handleNavigateToDMs}
                      />
                    )}
                    {activeTab === "resources" && selectedCommunity && (
                      <SpacesArea
                        communityId={selectedCommunity}
                        selectedSpace="resources"
                        onNavigateToDMs={handleNavigateToDMs}
                      />
                    )}
                  </>
                )
                : mobileView === "channels"
                ? (
                  <CommunityPanel
                    communityId={selectedCommunity}
                    selectedChannel={selectedChannel}
                    onSelectChannel={handleChannelSelect}
                    onSelectCommunity={handleCommunitySelect}
                    onNavigateToDMs={handleNavigateToDMs}
                  />
                )
                : (
                  <div className="h-full">
                    {/* Mobile Members View */}
                    {selectedCommunity && selectedChannel && (
                      <MemberList
                        communityId={selectedCommunity}
                        channelId={selectedChannel}
                        onNavigateToDMs={handleNavigateToDMs}
                      />
                    )}
                  </div>
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
                                  onNavigateToDMs={handleNavigateToDMs}
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
                            onNavigateToDMs={handleNavigateToDMs}
                          />
                        )}
                        {activeTab === "resources" && selectedCommunity && (
                          <SpacesArea
                            communityId={selectedCommunity}
                            selectedSpace="resources"
                            onNavigateToDMs={handleNavigateToDMs}
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
