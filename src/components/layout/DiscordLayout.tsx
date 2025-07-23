import { useState, useEffect } from "react";
import { AppSidebar } from "./AppSidebar";
import { CommunityPanel } from "./CommunityPanel";
import { ChatArea } from "./ChatArea";
import { MemberList } from "./MemberList";
import { UserPanel } from "./UserPanel";
import { JoinRequestDialog } from "@/components/community/JoinRequestDialog";
import { useChannels } from "@/hooks/useChannels";
import { useUrlNavigation } from "@/hooks/useUrlNavigation";
import { useUserCommunityMembership } from "@/hooks/useUserCommunityMembership";

export function DiscordLayout() {
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [showMemberList, setShowMemberList] = useState(true);
  const [dmTargetPubkey, setDmTargetPubkey] = useState<string | null>(null);
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  const { data: channels } = useChannels(selectedCommunity);
  const { communityId: urlCommunityId, isJoinRequest, clearNavigation } = useUrlNavigation();
  const { data: membershipStatus } = useUserCommunityMembership(urlCommunityId);

  const handleNavigateToDMs = (targetPubkey?: string) => {
    setSelectedCommunity(null);
    setSelectedChannel(null);
    if (targetPubkey) {
      setDmTargetPubkey(targetPubkey);
    }
  };

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

  // Auto-select general channel when community is selected
  useEffect(() => {
    if (selectedCommunity && channels && channels.length > 0) {
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
    } else if (!selectedCommunity) {
      // Clear channel selection when no community is selected
      setSelectedChannel(null);
    }
  }, [selectedCommunity, channels]);

  const handleJoinSuccess = (communityId: string) => {
    // After successful join, select the community
    setSelectedCommunity(communityId);
    clearNavigation();
  };

  const handleJoinDialogClose = () => {
    setShowJoinDialog(false);
    clearNavigation();
  };

  return (
    <>
      <div className="flex h-screen bg-gray-800 text-gray-100">
        {/* Main Sidebar - Communities and DMs */}
        <div className="w-16 bg-gray-900 flex flex-col h-full">
          <AppSidebar
            selectedCommunity={selectedCommunity}
            onSelectCommunity={setSelectedCommunity}
          />
        </div>

        {selectedCommunity ? (
          <>
            {/* Community/Channel Sidebar */}
            <div className="w-60 bg-gray-700 flex flex-col">
              <CommunityPanel
                communityId={selectedCommunity}
                selectedChannel={selectedChannel}
                onSelectChannel={setSelectedChannel}
                onNavigateToDMs={handleNavigateToDMs}
              />
              <UserPanel />
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
              <ChatArea
                communityId={selectedCommunity}
                channelId={selectedChannel}
                onToggleMemberList={() => setShowMemberList(!showMemberList)}
                onNavigateToDMs={handleNavigateToDMs}
              />
            </div>

            {/* Member List */}
            {showMemberList && (
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