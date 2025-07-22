import { Hash, Users, Search, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { useCommunities } from "@/hooks/useCommunities";
import { useChannels } from "@/hooks/useChannels";

interface ChatAreaProps {
  communityId: string | null;
  channelId: string | null;
  onToggleMemberList: () => void;
}

export function ChatArea({ communityId, channelId, onToggleMemberList }: ChatAreaProps) {
  const navigate = useNavigate();
  const { data: communities } = useCommunities();
  const { data: channels } = useChannels(communityId);

  const community = communities?.find(c => c.id === communityId);
  const channel = channels?.find(c => c.id === channelId);

  if (!communityId) {
    // Direct Messages view - handled by CommunityPanel
    return null;
  }

  if (!community || !channelId) {
    return (
      <div className="flex flex-col h-full">
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-12 border-b border-gray-600 flex items-center justify-between px-4">
        <div className="flex items-center space-x-2">
          {isVoiceChannel ? (
            <div className="w-5 h-5 text-green-500">🔊</div>
          ) : (
            <Hash className="w-5 h-5 text-gray-400" />
          )}
          <span className="font-semibold text-white">{channelName}</span>
          {channel?.description && (
            <>
              <div className="w-px h-4 bg-gray-600" />
              <span className="text-sm text-gray-400">{channel.description}</span>
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
          <Button variant="ghost" size="icon" className="w-6 h-6">
            <HelpCircle className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 flex flex-col">
        <MessageList
          communityId={communityId}
          channelId={channelId}
        />

        {/* Message Input */}
        <div className="p-4">
          <MessageInput
            communityId={communityId}
            channelId={channelId}
            placeholder={`Message #${channelName}`}
          />
        </div>
      </div>
    </div>
  );
}