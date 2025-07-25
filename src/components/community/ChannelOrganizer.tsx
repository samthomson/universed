import { useState, useMemo } from 'react';
import {
  Hash,
  Volume2,
  Settings,
  ChevronRight,
  Folder,
  FolderPlus,
  Plus,
  Lock,
  Copy,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Skeleton } from "@/components/ui/skeleton";
import { CreateChannelDialog } from "./CreateChannelDialog";
import { FolderManagementDialog } from "./FolderManagementDialog";
import { useChannels, type Channel } from "@/hooks/useChannels";
import { useChannelFolders, type ChannelFolder } from "@/hooks/useChannelFolders";
import { useChannelPermissions, useCanAccessChannel } from "@/hooks/useChannelPermissions";

import { useHoverPreloader } from "@/hooks/useHoverPreloader";

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
  const { data: channels, isLoading: isLoadingChannels } = useChannels(communityId);
  const { data: folders, isLoading: isLoadingFolders } = useChannelFolders(communityId);
  const { onChannelHover, onChannelHoverEnd } = useHoverPreloader();

  // Show loading only if we have no data AND we're actually loading (not just fetching in background)
  const shouldShowLoading = (isLoadingChannels && !channels) || (isLoadingFolders && !folders);
  const [textChannelsOpen, setTextChannelsOpen] = useState(true);
  const [voiceChannelsOpen, setVoiceChannelsOpen] = useState(true);
  const [showFolderManagement, setShowFolderManagement] = useState(false);
  const [folderStates, setFolderStates] = useState<Record<string, boolean>>({});

  // Filter channels to only show those the user can access
  const visibleChannels = useMemo(() => {
    if (!channels) return [];
    // We'll filter channels in the ChannelItem component to avoid too many permission checks
    // For now, return all channels but they'll be hidden if no access
    return channels;
  }, [channels]);

  // Group channels by folder and type
  const channelsWithoutFolder = visibleChannels?.filter(c => !c.folderId) || [];
  const textChannelsWithoutFolder = channelsWithoutFolder.filter(c => c.type === 'text');
  const voiceChannelsWithoutFolder = channelsWithoutFolder.filter(c => c.type === 'voice');

  const channelsByFolder = folders?.reduce((acc, folder) => {
    const folderChannels = visibleChannels?.filter(c => c.folderId === folder.id) || [];
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

  // Show loading skeleton only if we have no data AND we're actually loading (not background fetching)
  if (shouldShowLoading) {
    return <ChannelOrganizerSkeleton />;
  }

  return (
    <div className="space-y-1 overflow-hidden">
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
          onChannelHover={onChannelHover}
          onChannelHoverEnd={onChannelHoverEnd}
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
            <ChannelItemWithPermissionCheck
              key={channel.id}
              channel={channel}
              isSelected={selectedChannel === channel.id}
              onSelect={() => onSelectChannel(channel.id)}
              onSettings={() => onChannelSettings(channel)}
              onCopyLink={() => copyChannelLink(channel)}
              canModerate={canModerate}
              communityId={communityId}
              onChannelHover={onChannelHover}
              onChannelHoverEnd={onChannelHoverEnd}
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
            <ChannelItemWithPermissionCheck
              key={channel.id}
              channel={channel}
              isSelected={selectedChannel === channel.id}
              onSelect={() => onSelectChannel(channel.id)}
              onSettings={() => onChannelSettings(channel)}
              onCopyLink={() => copyChannelLink(channel)}
              canModerate={canModerate}
              communityId={communityId}
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

// Loading skeleton for ChannelOrganizer
function ChannelOrganizerSkeleton() {
  return (
    <div className="space-y-1">
      {/* Folders skeleton */}
      <div className="space-y-1">
        <div className="flex items-center group">
          <div className="flex-1 flex items-center p-1 h-auto">
            <Skeleton className="w-3 h-3 mr-1" />
            <Skeleton className="w-4 h-4 mr-1" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="ml-2 h-4 w-6 rounded-full" />
          </div>
        </div>
        {/* Folder channels skeleton */}
        <div className="space-y-0.5 ml-2 border-l border-gray-600/40 pl-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="ml-1">
              <div className="flex items-center h-8 px-2">
                <div className="w-5 h-5 flex items-center justify-center mr-1.5 flex-shrink-0">
                  <Skeleton className="w-4 h-4" />
                </div>
                <Skeleton className="h-3 w-16 flex-1 min-w-0" />
                <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                  <Skeleton className="w-3 h-3 flex-shrink-0" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Text Channels skeleton */}
      <div className="space-y-1">
        <div className="flex items-center justify-between group">
          <div className="flex-1 flex items-center p-1 h-auto">
            <Skeleton className="w-3 h-3 mr-1" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="space-y-0.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="ml-4">
              <div className="flex items-center h-8 px-2">
                <div className="w-5 h-5 flex items-center justify-center mr-1.5 flex-shrink-0">
                  <Skeleton className="w-4 h-4" />
                </div>
                <Skeleton className="h-3 w-20 flex-1 min-w-0" />
                <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                  <Skeleton className="w-3 h-3 flex-shrink-0" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Voice Channels skeleton */}
      <div className="space-y-1">
        <div className="flex items-center justify-between group">
          <div className="flex-1 flex items-center p-1 h-auto">
            <Skeleton className="w-3 h-3 mr-1" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <div className="space-y-0.5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="ml-4">
              <div className="flex items-center h-8 px-2">
                <div className="w-5 h-5 flex items-center justify-center mr-1.5 flex-shrink-0">
                  <Skeleton className="w-4 h-4" />
                </div>
                <Skeleton className="h-3 w-24 flex-1 min-w-0" />
                <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                  <Skeleton className="w-3 h-3 flex-shrink-0" />
                  <div className="flex items-center text-xs flex-shrink-0">
                    <Skeleton className="w-2 h-2 rounded-full mr-1" />
                    <Skeleton className="w-2 h-3" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
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
  onChannelCreated,
  onChannelHover,
  onChannelHoverEnd
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
  onChannelHover?: (communityId: string, channelId: string) => void;
  onChannelHoverEnd?: (communityId: string, channelId: string) => void;
}) {
  const allChannels = [...textChannels, ...voiceChannels];

  return (
    <div className="space-y-1 overflow-hidden">
      <ContextMenu>
        <ContextMenuTrigger>
          <Collapsible open={isOpen} onOpenChange={onToggle}>
            <div className="flex items-center group overflow-hidden">
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

            <CollapsibleContent className="space-y-0.5 ml-1 border-l border-gray-600/40 pl-1 overflow-hidden">
              {allChannels.map((channel) => (
                <ChannelItemWithPermissionCheck
                  key={channel.id}
                  channel={channel}
                  isSelected={selectedChannel === channel.id}
                  onSelect={() => onSelectChannel(channel.id)}
                  onSettings={() => onChannelSettings(channel)}
                  onCopyLink={() => onCopyChannelLink(channel)}
                  canModerate={canModerate}
                  inFolder={true}
                  communityId={communityId}
                  onChannelHover={onChannelHover}
                  onChannelHoverEnd={onChannelHoverEnd}
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

// Wrapper component that checks permissions before rendering
function ChannelItemWithPermissionCheck(props: {
  channel: Channel;
  isSelected: boolean;
  onSelect: () => void;
  onSettings: () => void;
  onCopyLink: () => void;
  canModerate: boolean;
  inFolder?: boolean;
  communityId: string;
  onChannelHover?: (communityId: string, channelId: string) => void;
  onChannelHoverEnd?: (communityId: string, channelId: string) => void;
}) {
  const { canAccess } = useCanAccessChannel(props.communityId, props.channel.id, 'read');

  // If user can't access the channel and is not a moderator, don't show it
  if (!canAccess && !props.canModerate) {
    return null;
  }

  return <ChannelItem {...props} hasAccess={canAccess} />;
}

// Enhanced Channel Item with Discord-like styling and context menu
function ChannelItem({
  channel,
  isSelected,
  onSelect,
  onSettings,
  onCopyLink,
  canModerate,
  inFolder = false,
  communityId,
  hasAccess = true,
  onChannelHover,
  onChannelHoverEnd
}: {
  channel: Channel;
  isSelected: boolean;
  onSelect: () => void;
  onSettings: () => void;
  onCopyLink: () => void;
  canModerate: boolean;
  inFolder?: boolean;
  communityId?: string;
  hasAccess?: boolean;
  onChannelHover?: (communityId: string, channelId: string) => void;
  onChannelHoverEnd?: (communityId: string, channelId: string) => void;
}) {
  const { data: permissions } = useChannelPermissions(communityId || '', channel.id);

  // Determine icon type once based on channel properties
  const iconType = channel.type === 'voice' ? 'voice' : 'text';

  // Stable icon rendering without dynamic checks
  const ChannelIcon = iconType === 'voice' ? Volume2 : Hash;

  // Determine privacy icon - simplified for stability
  const getPrivacyIcon = () => {
    // No access - always show lock
    if (!hasAccess) {
      return <Lock className="w-3 h-3 text-gray-500 opacity-50" />;
    }

    // No permissions data yet - return empty space to prevent layout shift
    if (!permissions) {
      return <span className="w-3 h-3 block" />;
    }

    // Private channel (any restriction)
    if (permissions.readPermissions !== 'everyone' || permissions.writePermissions !== 'everyone') {
      return <Lock className="w-3 h-3 text-gray-500 opacity-50" />;
    }

    // Public channel - no icon needed, just empty space
    return <span className="w-3 h-3 block" />;
  };

  return (
    <div className={`${inFolder ? 'ml-1' : 'ml-4'}`}>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className="group flex items-center h-8 px-2 rounded-sm hover:bg-gray-600/40 transition-colors duration-150 relative overflow-hidden"
            onMouseEnter={() => communityId && onChannelHover?.(communityId, channel.id)}
            onMouseLeave={() => communityId && onChannelHoverEnd?.(communityId, channel.id)}
          >
            {/* Selected indicator */}
            {isSelected && (
              <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-5 bg-white dark:bg-gray-200 rounded-r-full"></div>
            )}

            {/* Fixed width icon container */}
            <div className="w-5 h-5 flex items-center justify-center mr-1.5 flex-shrink-0">
              <ChannelIcon className="w-4 h-4 text-gray-400" />
            </div>

            {/* Channel name - clickable area */}
            <button
              className={`
                flex-1 text-left text-sm font-medium truncate min-w-0
                ${isSelected
                  ? 'text-white'
                  : hasAccess
                    ? 'text-gray-300 hover:text-gray-100'
                    : 'text-gray-500 hover:text-gray-400 italic'
                }
              `}
              onClick={onSelect}
            >
              {channel.name}
            </button>

            {/* Right side indicators - fixed width container */}
            <div className="flex items-center gap-1 ml-1 flex-shrink-0">
              {/* Privacy icon slot - always reserve space */}
              <div className="w-3 h-3 flex items-center justify-center flex-shrink-0">
                {getPrivacyIcon()}
              </div>

              {/* Voice channel users - fixed width */}
              {channel.type === 'voice' && (
                <div className="flex items-center text-xs text-gray-500 flex-shrink-0">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                  <span>0</span>
                </div>
              )}
            </div>
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
