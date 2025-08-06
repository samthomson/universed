import { Hash, Users, Search, Volume2, Settings, Eye, UserPlus, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { VoiceChannel } from "@/components/voice/VoiceChannel";
import { useCommunities } from "@/hooks/useCommunities";
import { useChannels } from "@/hooks/useChannels";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useCanModerate } from "@/hooks/useCommunityRoles";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { ChannelSettingsDialog } from "@/components/community/ChannelSettingsDialog";
import { toast } from "sonner";

interface ChatAreaProps {
  communityId: string | null;
  channelId: string | null;
  onToggleMemberList: () => void;
  onNavigateToDMs?: (targetPubkey: string) => void;
  onCloseCommunitySelectionDialog?: () => void;
  preloadedMessages?: import("@nostrify/nostrify").NostrEvent[];
}

export function ChatArea({ communityId, channelId, onToggleMemberList, onNavigateToDMs, onCloseCommunitySelectionDialog, preloadedMessages }: ChatAreaProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: communities } = useCommunities();
  const { data: channels } = useChannels(communityId);
  const { canModerate } = useCanModerate(communityId || '');
  const [showChannelSettings, setShowChannelSettings] = useState(false);

  const community = communities?.find(c => c.id === communityId);
  const channel = channels?.find(c => c.id === channelId);

  if (!communityId) {
    // Direct Messages view - handled by CommunityPanel
    return null;
  }

  if (!community || !channelId) {
    return (
      <div className="flex flex-col h-full w-full max-w-full overflow-hidden">
        {/* Header Skeleton */}
        <div className="h-12 border-b border-gray-600 flex items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 bg-gray-600 rounded animate-pulse" />
            <div className="w-24 h-5 bg-gray-600 rounded animate-pulse" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <Hash className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Select a channel</h3>
            <p className="text-sm">Choose a channel to start chatting!</p>
          </div>
        </div>
      </div>
    );
  }

  const channelName = channel?.name || channelId;
  const isVoiceChannel = channel?.type === 'voice';

  const copyChannelLink = () => {
    const channelLink = `${window.location.origin}/communities/${communityId}/channels/${channelId}`;
    navigator.clipboard.writeText(channelLink);
    toast.success("Channel link copied to clipboard!");
  };

  return (
    <div className="flex flex-col h-full chat-container">
      {/* Header - Hidden on mobile since it's handled by DiscordLayout */}
      {!isMobile && (
        <div className="h-12 border-b border-gray-600 flex items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            {isVoiceChannel ? (
              <Volume2 className="w-5 h-5 text-green-500" />
            ) : (
              <Hash className="w-5 h-5 text-gray-400" />
            )}
            <span className="font-semibold text-white">{channelName}</span>
            {channel?.description && (
              <>
                <div className="w-px h-4 bg-gray-600" />
                <span className="text-sm text-gray-400 hidden lg:inline">{channel.description}</span>
              </>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6"
              onClick={() => navigate('/search')}
            >
              <Search className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6"
              onClick={onToggleMemberList}
            >
              <Users className="w-4 h-4" />
            </Button>
            {canModerate && channel && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-6 h-6">
                    <Settings className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[200px]">
                  <DropdownMenuLabel>Channel Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowChannelSettings(true)}>
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
                  <DropdownMenuItem onClick={copyChannelLink}>
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
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0 w-full max-w-full overflow-hidden">
        {isVoiceChannel ? (
          /* Voice Channel Interface */
          <div className="flex-1 p-4">
            <VoiceChannel
              channelId={channelId}
              channelName={channelName}
              className="max-w-md mx-auto mt-8"
            />
          </div>
        ) : (
          /* Text Channel Interface */
          <>
            {/* Messages take up remaining space */}
            <MessageList
              communityId={communityId}
              channelId={channelId}
              onNavigateToDMs={onNavigateToDMs}
              onCloseCommunitySelectionDialog={onCloseCommunitySelectionDialog}
              preloadedMessages={preloadedMessages}
            />

            {/* Fixed bottom section */}
            <div className="flex-shrink-0">
              {/* Typing Indicator */}
              <TypingIndicator channelId={channelId} />

              {/* Message Input */}
              <div className={`p-4 ${isMobile ? 'mobile-input-container pb-safe' : ''}`}>
                <MessageInput
                  communityId={communityId}
                  channelId={channelId}
                  placeholder={`Message #${channelName}`}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Channel Settings Dialog */}
      {channel && (
        <ChannelSettingsDialog
          channel={channel}
          communityId={communityId!}
          open={showChannelSettings}
          onOpenChange={setShowChannelSettings}
        />
      )}
    </div>
  );
}