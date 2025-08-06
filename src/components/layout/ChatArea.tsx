import {
  Copy,
  Hash,
  HelpCircle,
  Search,
  Settings,
  Users,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { VoiceChannel } from "@/components/voice/VoiceChannel";
import { useChannels } from "@/hooks/useChannels";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useCanModerate } from "@/hooks/useCommunityRoles";
import { useMessages } from "@/hooks/useMessages";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { ChannelSettingsDialog } from "@/components/community/ChannelSettingsDialog";
import { toast } from "sonner";

import { BaseMessageList } from "@/components/messaging/BaseMessageList";
import { BaseMessageInput } from "@/components/messaging/BaseMessageInput";
import {
  groupMessageInputConfig,
  groupMessageItemConfig,
  groupMessageListConfig,
} from "@/components/messaging/configs/groupConfig";

interface ChatAreaProps {
  communityId: string | null;
  channelId: string | null;
  onToggleMemberList: () => void;
  onNavigateToDMs?: (targetPubkey: string) => void;
}

function CommunityChat(
  { communityId, channelId, onToggleMemberList, onNavigateToDMs }:
    & Omit<ChatAreaProps, "communityId" | "channelId">
    & { communityId: string; channelId: string },
) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: channels } = useChannels(communityId);
  const { canModerate } = useCanModerate(communityId);
  const [showChannelSettings, setShowChannelSettings] = useState(false);

  const { user } = useCurrentUser();
  const { data: messages, isLoading } = useMessages(communityId, channelId);
  const { mutateAsync: createEvent, isPending: isSending } = useNostrPublish();

  const channel = channels?.find((c) => c.id === channelId);

  if (!channel) {
    // This should theoretically not happen if channelId is guaranteed to be valid
    return <div>Channel not found</div>;
  }

  const channelName = channel?.name || channelId;
  const isVoiceChannel = channel?.type === "voice";

  const copyChannelLink = () => {
    const channelLink =
      `${window.location.origin}/communities/${communityId}/channels/${channelId}`;
    navigator.clipboard.writeText(channelLink);
    toast.success("Channel link copied to clipboard!");
  };

  const handleSendMessage = async (content: string, mentions: string[][]) => {
    if (!user || !communityId || !channelId) return;
    const [kind, pubkey, identifier] = communityId.split(":");

    const tags = [
      ["t", channelId],
      ["a", `${kind}:${pubkey}:${identifier}`],
      ...mentions,
    ];

    await createEvent({
      kind: 9411,
      content,
      tags,
    });
  };

  return (
    <div className="flex flex-col h-full chat-container">
      {!isMobile && (
        <div className="h-12 border-b flex items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            {isVoiceChannel
              ? <Volume2 className="w-5 h-5 text-green-500" />
              : <Hash className="w-5 h-5 text-muted-foreground" />}
            <span className="font-semibold">{channelName}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6"
              onClick={() => navigate("/search")}
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
            {canModerate && channel
              ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-6 h-6">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setShowChannelSettings(true)}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Edit Channel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={copyChannelLink}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Channel Link
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )
              : (
                <Button variant="ghost" size="icon" className="w-6 h-6">
                  <HelpCircle className="w-4 h-4" />
                </Button>
              )}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0 w-full max-w-full overflow-hidden">
        {isVoiceChannel
          ? (
            <div className="flex-1 p-4">
              <VoiceChannel channelId={channelId} channelName={channelName} />
            </div>
          )
          : (
            <>
              <BaseMessageList
                messages={messages || []}
                isLoading={isLoading}
                config={groupMessageListConfig}
                messageItemProps={{
                  config: groupMessageItemConfig,
                  onNavigateToDMs,
                }}
              />

              <div className="flex-shrink-0">
                <TypingIndicator channelId={channelId} />
                <div className="p-4">
                  <BaseMessageInput
                    onSendMessage={handleSendMessage}
                    config={groupMessageInputConfig}
                    placeholder={`Message #${channelName}`}
                    isSending={isSending}
                  />
                </div>
              </div>
            </>
          )}
      </div>

      {channel && (
        <ChannelSettingsDialog
          channel={channel}
          communityId={communityId}
          open={showChannelSettings}
          onOpenChange={setShowChannelSettings}
        />
      )}
    </div>
  );
}

export function ChatArea(props: ChatAreaProps) {
  if (!props.communityId || !props.channelId) {
    return (
      <div className="flex flex-col h-full w-full max-w-full overflow-hidden">
        <div className="h-12 border-b flex items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 bg-secondary rounded animate-pulse" />
            <div className="w-24 h-5 bg-secondary rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Hash className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Select a channel</h3>
            <p className="text-sm">Choose a channel to start chatting!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CommunityChat
      {...props}
      communityId={props.communityId}
      channelId={props.channelId}
    />
  );
}
