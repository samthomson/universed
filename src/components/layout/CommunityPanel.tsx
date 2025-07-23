import { Settings, MoreHorizontal, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DirectMessages } from "@/components/dm/DirectMessages";
import { useCommunities } from "@/hooks/useCommunities";
import { CommunitySettings } from "@/components/community/CommunitySettings";
import { ChannelSettingsDialog } from "@/components/community/ChannelSettingsDialog";
import { FolderManagementDialog } from "@/components/community/FolderManagementDialog";
import { ChannelOrganizer } from "@/components/community/ChannelOrganizer";
import { useChannels, type Channel } from "@/hooks/useChannels";
import { useCanModerate } from "@/hooks/useCommunityRoles";
import { useState } from "react";

interface CommunityPanelProps {
  communityId: string | null;
  selectedChannel: string | null;
  onSelectChannel: (channelId: string | null) => void;
  dmTargetPubkey?: string | null;
  onDmTargetHandled?: () => void;
  onNavigateToDMs?: (targetPubkey: string) => void;
}

export function CommunityPanel({ communityId, selectedChannel, onSelectChannel, dmTargetPubkey, onDmTargetHandled, onNavigateToDMs }: CommunityPanelProps) {
  const { data: communities } = useCommunities();
  const { refetch: refetchChannels } = useChannels(communityId);
  const { canModerate } = useCanModerate(communityId || '');
  const [showSettings, setShowSettings] = useState(false);
  const [showFolderManagement, setShowFolderManagement] = useState(false);
  const [selectedChannelForSettings, setSelectedChannelForSettings] = useState<Channel | null>(null);

  const handleChannelCreated = () => {
    refetchChannels();
  };

  const community = communities?.find(c => c.id === communityId);

  if (!communityId) {
    // Direct Messages view - return the full DirectMessages component
    return (
      <DirectMessages
        targetPubkey={dmTargetPubkey}
        onTargetHandled={onDmTargetHandled}
        onNavigateToDMs={onNavigateToDMs}
      />
    );
  }

  if (!community) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-gray-600">
          <div className="h-6 bg-gray-600 rounded animate-pulse" />
        </div>
        <div className="flex-1 p-4">
          <div className="space-y-2">
            <div className="h-4 bg-gray-600 rounded animate-pulse" />
            <div className="h-4 bg-gray-600 rounded animate-pulse w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Community Header */}
      <div className="p-4 border-b border-gray-600 flex items-center justify-between">
        <h2 className="font-semibold text-white truncate">{community.name}</h2>
        <div className="flex items-center gap-1">
          {canModerate && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="w-6 h-6 hover:bg-gray-600/40 transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowFolderManagement(true)}>
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Manage Folders
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowSettings(true)}>
                  <Settings className="w-4 h-4 mr-2" />
                  Community Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {!canModerate && (
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 hover:bg-gray-600/40 transition-colors"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          <ChannelOrganizer
            communityId={communityId}
            selectedChannel={selectedChannel}
            onSelectChannel={(channelId) => onSelectChannel(channelId)}
            onChannelSettings={setSelectedChannelForSettings}
            canModerate={canModerate}
            onChannelCreated={handleChannelCreated}
          />
        </div>
      </ScrollArea>

      {/* Community Settings Dialog */}
      <CommunitySettings
        communityId={communityId}
        open={showSettings}
        onOpenChange={setShowSettings}
      />

      {/* Folder Management Dialog */}
      <FolderManagementDialog
        communityId={communityId}
        open={showFolderManagement}
        onOpenChange={setShowFolderManagement}
      />

      {/* Channel Settings Dialog */}
      {selectedChannelForSettings && (
        <ChannelSettingsDialog
          channel={selectedChannelForSettings}
          communityId={communityId}
          open={!!selectedChannelForSettings}
          onOpenChange={(open) => {
            if (!open) setSelectedChannelForSettings(null);
          }}
        />
      )}
    </div>
  );
}