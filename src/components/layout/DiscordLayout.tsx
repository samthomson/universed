import { useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { CommunityPanel } from "./CommunityPanel";
import { ChatArea } from "./ChatArea";
import { MemberList } from "./MemberList";
import { UserPanel } from "./UserPanel";

export function DiscordLayout() {
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [showMemberList, setShowMemberList] = useState(true);

  return (
    <div className="flex h-screen bg-gray-800 text-gray-100">
      {/* Main Sidebar - Communities and DMs */}
      <div className="w-16 bg-gray-900 flex flex-col">
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
            />
            <UserPanel />
          </div>

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col">
            <ChatArea
              communityId={selectedCommunity}
              channelId={selectedChannel}
              onToggleMemberList={() => setShowMemberList(!showMemberList)}
            />
          </div>

          {/* Member List */}
          {showMemberList && (
            <div className="w-60 bg-gray-700">
              <MemberList
                communityId={selectedCommunity}
                channelId={selectedChannel}
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
            />
          </div>

          {/* User Panel at bottom */}
          <div className="w-60 bg-gray-700 flex flex-col justify-end">
            <UserPanel />
          </div>
        </>
      )}
    </div>
  );
}