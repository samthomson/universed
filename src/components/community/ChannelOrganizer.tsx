import { useState } from 'react';
import {
  Hash,
  Volume2,
  Settings,
  ChevronRight,
  Folder,
  FolderPlus,
  MoreHorizontal,
  Plus,
  Lock,
  Megaphone,
  Eye,
  UserPlus,
  Copy,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuLabel
} from "@/components/ui/context-menu";
import { Badge } from "@/components/ui/badge";
import { CreateChannelDialog } from "./CreateChannelDialog";
import { FolderManagementDialog } from "./FolderManagementDialog";
import { useChannels, type Channel } from "@/hooks/useChannels";
import { useChannelFolders, type ChannelFolder } from "@/hooks/useChannelFolders";

interface ChannelOrganizerProps {
  communityId: string;
  selectedChannel: string | null;
  onSelectChannel: (channelId: string) => void;
  onChannelSettings: (channel: Channel) => void;
  canModerate: boolean;
  onChannelCreated: () => void;
}

export function ChannelOrganizer({
  communityId,
  selectedChannel,
  onSelectChannel,
  onChannelSettings,
  canModerate,
  onChannelCreated,
}: ChannelOrganizerProps) {
  const { data: channels } = useChannels(communityId);
  const { data: folders } = useChannelFolders(communityId);
  const [textChannelsOpen, setTextChannelsOpen] = useState(true);
  const [voiceChannelsOpen, setVoiceChannelsOpen] = useState(true);
  const [showFolderManagement, setShowFolderManagement] = useState(false);
  const [folderStates, setFolderStates] = useState<Record<string, boolean>>({});

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
    return folderStates[folderId] !== false;
  };

  const copyChannelLink = (channel: Channel) => {
    // Create a link to the channel
    const channelLink = `${window.location.origin}/communities/${communityId}/channels/${channel.id}`;
    navigator.clipboard.writeText(channelLink);
  };

  return (
    <div className="space-y-1">
      {/* Folders */}
      {Object.entries(channelsByFolder).map(([folderId, { folder, textChannels, voiceChannels }]) => (
        <FolderSection
          key={folderId}
          folder={folder}
          textChannels={textChannels}
          voiceChannels={voiceChannels}
          isOpen={isFolderOpen(folderId)}
          onToggle={() => toggleFolder(folderId)}
          selectedChannel={selectedChannel}
          onSelectChannel={onSelectChannel}
          onChannelSettings={onChannelSettings}
          onCopyChannelLink={copyChannelLink}
          canModerate={canModerate}
          communityId={communityId}
          onChannelCreated={onChannelCreated}
        />
      ))}

      {/* Text Channels (Root Level) */}
      {textChannelsWithoutFolder.length > 0 && (
        <CategorySection
          title="TEXT CHANNELS"
          isOpen={textChannelsOpen}
          onToggle={() => setTextChannelsOpen(!textChannelsOpen)}
          canModerate={canModerate}
          communityId={communityId}
          onChannelCreated={onChannelCreated}
          defaultChannelType="text"
        >
          {textChannelsWithoutFolder.map((channel) => (
            <ChannelItem
              key={channel.id}
              channel={channel}
              isSelected={selectedChannel === channel.id}
              onSelect={() => onSelectChannel(channel.id)}
              onSettings={() => onChannelSettings(channel)}
              onCopyLink={() => copyChannelLink(channel)}
              canModerate={canModerate}
            />
          ))}
        </CategorySection>
      )}

      {/* Voice Channels (Root Level) */}
      {voiceChannelsWithoutFolder.length > 0 && (
        <CategorySection
          title="VOICE CHANNELS"
          isOpen={voiceChannelsOpen}
          onToggle={() => setVoiceChannelsOpen(!voiceChannelsOpen)}
          canModerate={canModerate}
          communityId={communityId}
          onChannelCreated={onChannelCreated}
          defaultChannelType="voice"
        >
          {voiceChannelsWithoutFolder.map((channel) => (
            <ChannelItem
              key={channel.id}
              channel={channel}
              isSelected={selectedChannel === channel.id}
              onSelect={() => onSelectChannel(channel.id)}
              onSettings={() => onChannelSettings(channel)}
              onCopyLink={() => copyChannelLink(channel)}
              canModerate={canModerate}
            />
          ))}
        </CategorySection>
      )}



      {/* Folder Management Dialog */}
      <FolderManagementDialog
        communityId={communityId}
        open={showFolderManagement}
        onOpenChange={setShowFolderManagement}
      />
    </div>
  );
}

// Folder Section Component
function FolderSection({
  folder,
  textChannels,
  voiceChannels,
  isOpen,
  onToggle,
  selectedChannel,
  onSelectChannel,
  onChannelSettings,
  onCopyChannelLink,
  canModerate,
  communityId,
  onChannelCreated
}: {
  folder: ChannelFolder;
  textChannels: Channel[];
  voiceChannels: Channel[];
  isOpen: boolean;
  onToggle: () => void;
  selectedChannel: string | null;
  onSelectChannel: (channelId: string) => void;
  onChannelSettings: (channel: Channel) => void;
  onCopyChannelLink: (channel: Channel) => void;
  canModerate: boolean;
  communityId: string;
  onChannelCreated: () => void;
}) {
  const allChannels = [...textChannels, ...voiceChannels];

  return (
    <div className="space-y-1">
      <ContextMenu>
        <ContextMenuTrigger>
          <Collapsible open={isOpen} onOpenChange={onToggle}>
            <div className="flex items-center group">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex-1 justify-start p-1 h-auto text-xs font-semibold text-gray-400 hover:text-gray-300 hover:bg-gray-600/30 rounded-sm transition-all duration-150"
                >
                  <ChevronRight className={`w-3 h-3 mr-1 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                  <div className="flex items-center">
                    <Folder className={`w-4 h-4 mr-1 transition-colors duration-150 ${isOpen ? 'text-gray-300' : 'text-gray-400'}`} />
                    <span className="tracking-wide">{folder.name.toUpperCase()}</span>
                  </div>
                  {allChannels.length > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs px-1 py-0">
                      {allChannels.length}
                    </Badge>
                  )}
                </Button>
              </CollapsibleTrigger>

              {canModerate && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:bg-gray-600/40"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="right">
                    <DropdownMenuLabel>Create Channel</DropdownMenuLabel>
                    <CreateChannelDialog
                      communityId={communityId}
                      folderId={folder.id}
                      onChannelCreated={onChannelCreated}
                      trigger={
                        <DropdownMenuItem onSelect={e => e.preventDefault()}>
                          <Hash className="w-4 h-4 mr-2" />
                          Text Channel
                        </DropdownMenuItem>
                      }
                    />
                    <CreateChannelDialog
                      communityId={communityId}
                      folderId={folder.id}
                      defaultType="voice"
                      onChannelCreated={onChannelCreated}
                      trigger={
                        <DropdownMenuItem onSelect={e => e.preventDefault()}>
                          <Volume2 className="w-4 h-4 mr-2" />
                          Voice Channel
                        </DropdownMenuItem>
                      }
                    />
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <CollapsibleContent className="space-y-0.5 ml-2 border-l border-gray-600/40 pl-2">
              {allChannels.map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isSelected={selectedChannel === channel.id}
                  onSelect={() => onSelectChannel(channel.id)}
                  onSettings={() => onChannelSettings(channel)}
                  onCopyLink={() => onCopyChannelLink(channel)}
                  canModerate={canModerate}
                  inFolder={true}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        </ContextMenuTrigger>

        {canModerate && (
          <ContextMenuContent>
            <ContextMenuLabel>Folder Options</ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuItem>
              <FolderPlus className="w-4 h-4 mr-2" />
              Edit Folder
            </ContextMenuItem>
            <ContextMenuItem>
              <Settings className="w-4 h-4 mr-2" />
              Folder Settings
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem className="text-red-400">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Folder
            </ContextMenuItem>
          </ContextMenuContent>
        )}
      </ContextMenu>
    </div>
  );
}

// Category Section Component (for root-level TEXT CHANNELS / VOICE CHANNELS)
function CategorySection({
  title,
  isOpen,
  onToggle,
  canModerate,
  communityId,
  onChannelCreated,
  defaultChannelType,
  children
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  canModerate: boolean;
  communityId: string;
  onChannelCreated: () => void;
  defaultChannelType: 'text' | 'voice';
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <div className="flex items-center justify-between group">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="flex-1 justify-start p-1 h-auto text-xs font-semibold text-gray-400 hover:text-gray-300 hover:bg-gray-600/30 rounded-sm transition-all duration-150"
          >
            <ChevronRight className={`w-3 h-3 mr-1 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
            <span className="tracking-wide">{title}</span>
          </Button>
        </CollapsibleTrigger>
        {canModerate && (
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:bg-gray-600/40"
          >
            <Plus className="w-3 h-3" />
          </Button>
        )}
      </div>
      <CollapsibleContent className="space-y-0.5">
        {children}
        <div className="ml-4 mt-1">
          <CreateChannelDialog
            communityId={communityId}
            defaultType={defaultChannelType}
            onChannelCreated={onChannelCreated}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Enhanced Channel Item with Discord-like styling and context menu
function ChannelItem({
  channel,
  isSelected,
  onSelect,
  onSettings,
  onCopyLink,
  canModerate,
  inFolder = false
}: {
  channel: Channel;
  isSelected: boolean;
  onSelect: () => void;
  onSettings: () => void;
  onCopyLink: () => void;
  canModerate: boolean;
  inFolder?: boolean;
}) {
  const getChannelIcon = () => {
    if (channel.type === 'voice') {
      return <Volume2 className="w-4 h-4 mr-2 text-gray-400" />;
    }

    // Special icons for certain channel names
    if (channel.name.toLowerCase().includes('announcement') || channel.name.toLowerCase().includes('news')) {
      return <Megaphone className="w-4 h-4 mr-2 text-gray-400" />;
    }

    if (channel.name.toLowerCase().includes('rule') || channel.name.toLowerCase().includes('info')) {
      return <Lock className="w-4 h-4 mr-2 text-gray-400" />;
    }

    return <Hash className="w-4 h-4 mr-2 text-gray-500" />;
  };

  const hasNotifications = Math.random() > 0.7; // Demo notification state
  const isPrivate = channel.name.toLowerCase().includes('private') || channel.name.toLowerCase().includes('admin');

  return (
    <div className={`group ${inFolder ? 'ml-0' : 'ml-4'}`}>
      <ContextMenu>
        <ContextMenuTrigger>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className={`
                flex-1 justify-start px-2 py-1 h-auto min-h-[32px] rounded-sm transition-all duration-150 relative
                ${isSelected
                  ? 'bg-gray-600/60 text-white shadow-sm'
                  : 'text-gray-300 hover:text-gray-100 hover:bg-gray-600/40'
                }
                ${inFolder ? 'ml-1' : ''}
              `}
              onClick={onSelect}
            >
              {getChannelIcon()}
              <span className="text-sm font-medium truncate">{channel.name}</span>

              {/* Discord-like channel indicators */}
              <div className="ml-auto flex items-center space-x-1">
                {isPrivate && <Lock className="w-3 h-3 text-gray-500" />}
                {channel.type === 'voice' && (
                  <div className="flex items-center text-xs text-gray-500">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                    {Math.floor(Math.random() * 5)}
                  </div>
                )}
                {hasNotifications && (
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                )}
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-5 bg-white dark:bg-gray-200 rounded-r-full"></div>
              )}
            </Button>

            {canModerate && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:bg-gray-600/40 rounded-sm"
                  >
                    <MoreHorizontal className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[160px]">
                  <DropdownMenuLabel>Channel Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onSettings}>
                    <Settings className="w-4 h-4 mr-2" />
                    Edit Channel
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Eye className="w-4 h-4 mr-2" />
                    View Permissions
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite Members
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onCopyLink}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Channel Link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Channel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent>
          <ContextMenuLabel>{`#${channel.name}`}</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onCopyLink}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Link
          </ContextMenuItem>
          {canModerate && (
            <>
              <ContextMenuItem onClick={onSettings}>
                <Settings className="w-4 h-4 mr-2" />
                Edit Channel
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem className="text-red-400">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Channel
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
