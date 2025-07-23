import { Hash, Volume2, Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DirectMessages } from "@/components/dm/DirectMessages";
import { useCommunities } from "@/hooks/useCommunities";
import { CommunitySettings } from "@/components/community/CommunitySettings";
import { CreateChannelDialog } from "@/components/community/CreateChannelDialog";
import { useChannels } from "@/hooks/useChannels";
import { useState } from "react";

interface CommunityPanelProps {
  communityId: string | null;
  selectedChannel: string | null;
  onSelectChannel: (channelId: string | null) => void;
}

export function CommunityPanel({ communityId, selectedChannel, onSelectChannel }: CommunityPanelProps) {
  const { data: communities } = useCommunities();
  const { data: channels, refetch: refetchChannels } = useChannels(communityId);
  const [textChannelsOpen, setTextChannelsOpen] = useState(true);
  const [voiceChannelsOpen, setVoiceChannelsOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

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

  const textChannels = channels?.filter(c => c.type === 'text') || [];
  const voiceChannels = channels?.filter(c => c.type === 'voice') || [];

  return (
    <div className="flex flex-col h-full">
      {/* Community Header */}
      <div className="p-4 border-b border-gray-600 flex items-center justify-between">
        <h2 className="font-semibold text-white truncate">{community.name}</h2>
        <Button
          variant="ghost"
          size="icon"
          className="w-6 h-6"
          onClick={() => setShowSettings(true)}
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {/* Text Channels */}
          <Collapsible open={textChannelsOpen} onOpenChange={setTextChannelsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start p-1 h-auto text-xs font-semibold text-gray-400 hover:text-gray-300">
                <ChevronDown className={`w-3 h-3 mr-1 transition-transform ${textChannelsOpen ? '' : '-rotate-90'}`} />
                TEXT CHANNELS
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5">
              {textChannels.length === 0 ? (
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
              ) : (
                textChannels.map((channel) => (
                  <div key={channel.id} className="ml-4">
                    <Button
                      variant={selectedChannel === channel.id ? "secondary" : "ghost"}
                      size="sm"
                      className="w-full justify-start text-gray-300 hover:text-gray-100 h-8"
                      onClick={() => onSelectChannel(channel.id)}
                    >
                      <Hash className="w-4 h-4 mr-2" />
                      {channel.name}
                    </Button>
                  </div>
                ))
              )}
              <div className="ml-4">
                <CreateChannelDialog
                  communityId={communityId}
                  onChannelCreated={handleChannelCreated}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Voice Channels */}
          <Collapsible open={voiceChannelsOpen} onOpenChange={setVoiceChannelsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start p-1 h-auto text-xs font-semibold text-gray-400 hover:text-gray-300">
                <ChevronDown className={`w-3 h-3 mr-1 transition-transform ${voiceChannelsOpen ? '' : '-rotate-90'}`} />
                VOICE CHANNELS
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5">
              {voiceChannels.map((channel) => (
                <div key={channel.id} className="ml-4">
                  <Button
                    variant={selectedChannel === channel.id ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start text-gray-300 hover:text-gray-100 h-8"
                    onClick={() => onSelectChannel(channel.id)}
                  >
                    <Volume2 className="w-4 h-4 mr-2" />
                    {channel.name}
                  </Button>
                </div>
              ))}
              <div className="ml-4">
                <CreateChannelDialog
                  communityId={communityId}
                  onChannelCreated={handleChannelCreated}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      {/* Community Settings Dialog */}
      <CommunitySettings
        communityId={communityId}
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </div>
  );
}