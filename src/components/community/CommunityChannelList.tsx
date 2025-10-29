import { useState, useMemo } from 'react';
import { cn, generateSpaceUrl } from '@/lib/utils';
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
import { useToast } from "@/hooks/useToast";
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
import { useVoiceChannel } from "@/hooks/useVoiceChannel";
import { useDataManager, type DisplayChannel, type ChannelFolder } from "@/components/DataManagerProvider";

interface CommunityChannelListProps {
  communityId: string;
  selectedChannel: string | null;
  onSelectChannel: (channelId: string) => void;
  onChannelSettings: (channel: DisplayChannel) => void;
  canModerate: boolean;
  onChannelCreated: () => void;
}

export function CommunityChannelList({
  communityId,
  selectedChannel,
  onSelectChannel,
  onChannelSettings,
  canModerate,
  onChannelCreated,
}: CommunityChannelListProps) {
  const { toast } = useToast();
  const { communities } = useDataManager();

  // Get all data from DataManager - memoized to avoid recomputation on every render
  const folders = useMemo(() => communities.getFolders(communityId), [communities, communityId]);
  const channelsWithoutFolder = useMemo(() => communities.getChannelsWithoutFolder(communityId), [communities, communityId]);

  // Use the specific channels loading state for better UX
  const isLoading = communities.isLoadingChannels;

  const [textChannelsOpen, setTextChannelsOpen] = useState(true);
  const [voiceChannelsOpen, setVoiceChannelsOpen] = useState(true);
  const [showFolderManagement, setShowFolderManagement] = useState(false);
  const [folderStates, setFolderStates] = useState<Record<string, boolean>>({});

  const toggleFolder = (folderId: string) => {
    setFolderStates(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  const isFolderOpen = (folderId: string) => {
    return folderStates[folderId] !== false;
  };

  const copyChannelLink = (channel: DisplayChannel) => {
    // Create a link to the channel using naddr format
    try {
      const channelLink = generateSpaceUrl(communityId, channel.id);
      navigator.clipboard.writeText(channelLink);
      toast({
        title: "Link copied",
        description: "Channel link copied to clipboard",
      });
    } catch {
      // Show error to user
      toast({
        title: "Error",
        description: "Failed to generate channel link. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Show loading skeleton if DataManager is still loading
  if (isLoading) {
    return <CommunityChannelListSkeleton />;
  }

  return (
    <div className="space-y-1 overflow-hidden">
      {/* Folders */}
      {folders.map((folder) => (
        <FolderSection
          key={folder.id}
          folder={folder}
          isOpen={isFolderOpen(folder.id)}
          onToggle={() => toggleFolder(folder.id)}
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
      {channelsWithoutFolder.text.length > 0 && (
        <CategorySection
          title="TEXT CHANNELS"
          isOpen={textChannelsOpen}
          onToggle={() => setTextChannelsOpen(!textChannelsOpen)}
          communityId={communityId}
          onChannelCreated={onChannelCreated}
          defaultChannelType="text"
        >
          {channelsWithoutFolder.text.map((channel) => (
            <ChannelItem
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

      {/* Voice Channels (Root Level) */}
      {channelsWithoutFolder.voice.length > 0 && (
        <CategorySection
          title="VOICE CHANNELS"
          isOpen={voiceChannelsOpen}
          onToggle={() => setVoiceChannelsOpen(!voiceChannelsOpen)}
          communityId={communityId}
          onChannelCreated={onChannelCreated}
          defaultChannelType="voice"
        >
          {channelsWithoutFolder.voice.map((channel) => (
            <ChannelItem
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

// Loading skeleton for CommunityChannelList
function CommunityChannelListSkeleton() {
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
  isOpen,
  onToggle,
  selectedChannel,
  onSelectChannel,
  onChannelSettings,
  onCopyChannelLink,
  canModerate,
  communityId,
  onChannelCreated,
  onChannelPreload
}: {
  folder: ChannelFolder;
  isOpen: boolean;
  onToggle: () => void;
  selectedChannel: string | null;
  onSelectChannel: (channelId: string) => void;
  onChannelSettings: (channel: DisplayChannel) => void;
  onCopyChannelLink: (channel: DisplayChannel) => void;
  canModerate: boolean;
  communityId: string;
  onChannelCreated: () => void;
  onChannelPreload?: (communityId: string, channelId: string) => void;
}) {
  // Channels are already included in the folder from DataManager
  const allChannels = folder.channels;

  return (
    <div className="space-y-1 overflow-hidden">
      <ContextMenu>
        <ContextMenuTrigger>
          <Collapsible open={isOpen} onOpenChange={onToggle}>
            <div className="flex items-center group overflow-hidden">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex-1 justify-start p-1 h-auto text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/30 rounded-sm transition-all duration-150"
                >
                  <ChevronRight className={`w-3 h-3 mr-1 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                  <div className="flex items-center">
                    <Folder className={`w-4 h-4 mr-1 transition-colors duration-150 ${isOpen ? 'text-foreground' : 'text-muted-foreground'}`} />
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
                      className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:bg-accent"
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
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isSelected={selectedChannel === channel.id}
                  onSelect={() => onSelectChannel(channel.id)}
                  onSettings={() => onChannelSettings(channel)}
                  onCopyLink={() => onCopyChannelLink(channel)}
                  canModerate={canModerate}
                  inFolder={true}
                  communityId={communityId}
                  onChannelPreload={onChannelPreload}
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
  communityId,
  onChannelCreated,
  defaultChannelType,
  children
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
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
            className="flex-1 justify-start p-1 h-auto text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/30 rounded-sm transition-all duration-150"
          >
            <ChevronRight className={`w-3 h-3 mr-1 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
            <span className="tracking-wide">{title}</span>
          </Button>
        </CollapsibleTrigger>
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

// No wrapper needed - all data is pre-computed in DataManager

// Pure view component - all data pre-computed in DataManager
function ChannelItem({
  channel,
  isSelected,
  onSelect,
  onSettings,
  onCopyLink,
  canModerate,
  inFolder = false,
  communityId,
  onChannelPreload
}: {
  channel: DisplayChannel;
  isSelected: boolean;
  onSelect: () => void;
  onSettings: () => void;
  onCopyLink: () => void;
  canModerate: boolean;
  inFolder?: boolean;
  communityId?: string;
  onChannelPreload?: (communityId: string, channelId: string) => void;
}) {
  // Get real-time voice channel status for voice channels
  const { voiceState } = useVoiceChannel(channel.type === 'voice' ? channel.id : '');
  const memberCount = voiceState?.members.length || 0;
  const hasUsersConnected = memberCount > 0;

  // All data is pre-computed in DataManager - no processing needed
  const ChannelIcon = channel.type === 'voice' ? Volume2 : Hash;

  return (
    <div className={`${inFolder ? 'ml-1' : 'ml-4'}`}>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className={cn(
              "group flex items-center h-8 px-2 rounded-sm transition-colors duration-150 relative overflow-hidden",
              {
                "bg-accent/80 dark:bg-accent/50": isSelected,
                "hover:bg-accent": !isSelected
              }
            )}
            onMouseDown={() => communityId && onChannelPreload?.(communityId, channel.id)}
          >
            {/* Selected indicator */}
            {isSelected && (
              <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-5 bg-nostr-purple rounded-r-full"></div>
            )}

            {/* Fixed width icon container */}
            <div className="w-5 h-5 flex items-center justify-center mr-1.5 flex-shrink-0">
              <ChannelIcon className="w-4 h-4 text-muted-foreground" />
            </div>

            {/* Channel name - clickable area */}
            <button
              className={`
                flex-1 text-left text-sm font-medium truncate min-w-0
                ${isSelected
                  ? 'text-foreground font-semibold'
                  : 'text-foreground hover:text-nostr-purple'
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
                {channel.isRestricted && <Lock className="w-3 h-3 text-muted-foreground opacity-50" />}
              </div>

              {/* Voice channel users - fixed width */}
              {channel.type === 'voice' && (
                <div className="flex items-center text-xs flex-shrink-0">
                  <div className={`w-2 h-2 rounded-full mr-1 ${hasUsersConnected ? 'bg-green-500' : 'bg-muted-foreground'}`}></div>
                  <span className={hasUsersConnected ? 'text-foreground' : 'text-muted-foreground'}>
                    {memberCount}
                  </span>
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
