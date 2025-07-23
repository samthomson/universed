import { Hash, Volume2, Settings, ChevronDown, Folder, FolderPlus, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DirectMessages } from "@/components/dm/DirectMessages";
import { useCommunities } from "@/hooks/useCommunities";
import { CommunitySettings } from "@/components/community/CommunitySettings";
import { CreateChannelDialog } from "@/components/community/CreateChannelDialog";
import { ChannelSettingsDialog } from "@/components/community/ChannelSettingsDialog";
import { FolderManagementDialog } from "@/components/community/FolderManagementDialog";
import { useChannels, type Channel } from "@/hooks/useChannels";
import { useChannelFolders, type ChannelFolder } from "@/hooks/useChannelFolders";
import { useCanModerate } from "@/hooks/useCommunityRoles";
import { useState } from "react";

interface CommunityPanelProps {
  communityId: string | null;
  selectedChannel: string | null;
  onSelectChannel: (channelId: string | null) => void;
}

export function CommunityPanel({ communityId, selectedChannel, onSelectChannel }: CommunityPanelProps) {
  const { data: communities } = useCommunities();
  const { data: channels, refetch: refetchChannels } = useChannels(communityId);
  const { data: folders } = useChannelFolders(communityId);
  const { canModerate } = useCanModerate(communityId || '');
  const [textChannelsOpen, setTextChannelsOpen] = useState(true);
  const [voiceChannelsOpen, setVoiceChannelsOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showFolderManagement, setShowFolderManagement] = useState(false);
  const [selectedChannelForSettings, setSelectedChannelForSettings] = useState<Channel | null>(null);
  const [folderStates, setFolderStates] = useState<Record<string, boolean>>({});

  const handleChannelCreated = () => {
    refetchChannels();
  };

  const community = communities?.find(c => c.id === communityId);

  if (!communityId) {
    // Direct Messages view - return the full DirectMessages component
    return <DirectMessages />;
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

  // Group channels by folder and type
  const channelsWithoutFolder = channels?.filter(c => !c.folderId) || [];
  const textChannelsWithoutFolder = channelsWithoutFolder.filter(c => c.type === 'text');
  const voiceChannelsWithoutFolder = channelsWithoutFolder.filter(c => c.type === 'voice');

  const channelsByFolder = folders?.reduce((acc, folder) => {
    const folderChannels = channels?.filter(c => c.folderId === folder.id) || [];
    acc[folder.id] = {
      folder,
      textChannels: folderChannels.filter(c => c.type === 'text'),
      voiceChannels: folderChannels.filter(c => c.type === 'voice'),
    };
    return acc;
  }, {} as Record<string, { folder: ChannelFolder; textChannels: Channel[]; voiceChannels: Channel[] }>) || {};

  const toggleFolder = (folderId: string) => {
    setFolderStates(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  const isFolderOpen = (folderId: string) => {
    return folderStates[folderId] !== false; // Default to open
  };

  return (
    <div className="flex flex-col h-full">
      {/* Community Header */}
      <div className="p-4 border-b border-gray-600 flex items-center justify-between">
        <h2 className="font-semibold text-white truncate">{community.name}</h2>
        <div className="flex items-center gap-1">
          {canModerate && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="w-6 h-6">
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
              className="w-6 h-6"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {/* Folders */}
          {Object.entries(channelsByFolder).map(([folderId, { folder, textChannels, voiceChannels }]) => (
            <div key={folderId} className="space-y-1">
              <Collapsible open={isFolderOpen(folderId)} onOpenChange={() => toggleFolder(folderId)}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start p-1 h-auto text-xs font-semibold text-gray-400 hover:text-gray-300">
                    <ChevronDown className={`w-3 h-3 mr-1 transition-transform ${isFolderOpen(folderId) ? '' : '-rotate-90'}`} />
                    <Folder className="w-3 h-3 mr-1" />
                    {folder.name.toUpperCase()}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="ml-4 space-y-0.5">
                  {/* Text channels in folder */}
                  {textChannels.map((channel) => (
                    <ChannelButton
                      key={channel.id}
                      channel={channel}
                      isSelected={selectedChannel === channel.id}
                      onSelect={() => onSelectChannel(channel.id)}
                      onSettings={() => setSelectedChannelForSettings(channel)}
                      canModerate={canModerate}
                    />
                  ))}
                  {/* Voice channels in folder */}
                  {voiceChannels.map((channel) => (
                    <ChannelButton
                      key={channel.id}
                      channel={channel}
                      isSelected={selectedChannel === channel.id}
                      onSelect={() => onSelectChannel(channel.id)}
                      onSettings={() => setSelectedChannelForSettings(channel)}
                      canModerate={canModerate}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          ))}

          {/* Text Channels (Root Level) */}
          {textChannelsWithoutFolder.length > 0 && (
            <Collapsible open={textChannelsOpen} onOpenChange={setTextChannelsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-start p-1 h-auto text-xs font-semibold text-gray-400 hover:text-gray-300">
                  <ChevronDown className={`w-3 h-3 mr-1 transition-transform ${textChannelsOpen ? '' : '-rotate-90'}`} />
                  TEXT CHANNELS
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5">
                {textChannelsWithoutFolder.map((channel) => (
                  <ChannelButton
                    key={channel.id}
                    channel={channel}
                    isSelected={selectedChannel === channel.id}
                    onSelect={() => onSelectChannel(channel.id)}
                    onSettings={() => setSelectedChannelForSettings(channel)}
                    canModerate={canModerate}
                  />
                ))}
                <div className="ml-4">
                  <CreateChannelDialog
                    communityId={communityId}
                    onChannelCreated={handleChannelCreated}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Voice Channels (Root Level) */}
          {voiceChannelsWithoutFolder.length > 0 && (
            <Collapsible open={voiceChannelsOpen} onOpenChange={setVoiceChannelsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-start p-1 h-auto text-xs font-semibold text-gray-400 hover:text-gray-300">
                  <ChevronDown className={`w-3 h-3 mr-1 transition-transform ${voiceChannelsOpen ? '' : '-rotate-90'}`} />
                  VOICE CHANNELS
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5">
                {voiceChannelsWithoutFolder.map((channel) => (
                  <ChannelButton
                    key={channel.id}
                    channel={channel}
                    isSelected={selectedChannel === channel.id}
                    onSelect={() => onSelectChannel(channel.id)}
                    onSettings={() => setSelectedChannelForSettings(channel)}
                    canModerate={canModerate}
                  />
                ))}
                <div className="ml-4">
                  <CreateChannelDialog
                    communityId={communityId}
                    onChannelCreated={handleChannelCreated}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Show default general channel if no channels exist */}
          {(!channels || channels.length === 0) && (
            <Collapsible open={textChannelsOpen} onOpenChange={setTextChannelsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-start p-1 h-auto text-xs font-semibold text-gray-400 hover:text-gray-300">
                  <ChevronDown className={`w-3 h-3 mr-1 transition-transform ${textChannelsOpen ? '' : '-rotate-90'}`} />
                  TEXT CHANNELS
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5">
                <div className="ml-4 py-1">
                  <Button
                    variant={selectedChannel === 'general' ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start text-gray-300 hover:text-gray-100 h-8"
                    onClick={() => onSelectChannel('general')}
                  >
                    <Hash className="w-4 h-4 mr-2" />
                    general
                  </Button>
                </div>
                <div className="ml-4">
                  <CreateChannelDialog
                    communityId={communityId}
                    onChannelCreated={handleChannelCreated}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
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

// Channel Button Component with context menu
function ChannelButton({
  channel,
  isSelected,
  onSelect,
  onSettings,
  canModerate
}: {
  channel: Channel;
  isSelected: boolean;
  onSelect: () => void;
  onSettings: () => void;
  canModerate: boolean;
}) {
  return (
    <div className="ml-4 group">
      <DropdownMenu>
        <div className="flex items-center">
          <Button
            variant={isSelected ? "secondary" : "ghost"}
            size="sm"
            className="flex-1 justify-start text-gray-300 hover:text-gray-100 h-8"
            onClick={onSelect}
          >
            {channel.type === 'text' ? (
              <Hash className="w-4 h-4 mr-2" />
            ) : (
              <Volume2 className="w-4 h-4 mr-2" />
            )}
            {channel.name}
          </Button>
          {canModerate && (
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Settings className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
          )}
        </div>
        {canModerate && (
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onSettings}>
              <Settings className="w-4 h-4 mr-2" />
              Channel Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        )}
      </DropdownMenu>
    </div>
  );
}