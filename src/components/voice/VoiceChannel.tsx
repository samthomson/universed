import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { VoiceControls } from './VoiceControls';
import { useVoiceChannel } from '@/hooks/useVoiceChannel';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { genUserName } from '@/lib/genUserName';
import { cn } from '@/lib/utils';

interface VoiceChannelProps {
  channelId: string;
  channelName: string;
  className?: string;
}

function VoiceMember({ pubkey, muted, deafened, speaking }: {
  pubkey: string;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
}) {
  const author = useAuthor(pubkey);
  const displayName = author.data?.metadata?.name || genUserName(pubkey);
  const profileImage = author.data?.metadata?.picture;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/50">
            <div className="relative">
              <Avatar className={cn(
                "w-8 h-8 transition-all",
                speaking && !muted ? "ring-2 ring-green-500" : "",
                deafened ? "opacity-50" : ""
              )}>
                <AvatarImage src={profileImage} alt={displayName} />
                <AvatarFallback className="text-xs">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              {/* Status indicators */}
              <div className="absolute -bottom-1 -right-1 flex space-x-1">
                {muted && (
                  <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                    <MicOff className="w-2 h-2 text-white" />
                  </div>
                )}
                {deafened && (
                  <div className="w-4 h-4 bg-gray-500 rounded-full flex items-center justify-center">
                    <VolumeX className="w-2 h-2 text-white" />
                  </div>
                )}
              </div>
            </div>

            <span className={cn(
              "text-sm font-medium",
              deafened ? "opacity-50" : "",
              speaking && !muted ? "text-green-600 dark:text-green-400" : ""
            )}>
              {displayName}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p>{displayName}</p>
            <div className="flex space-x-2 text-xs">
              {muted && <Badge variant="destructive" className="text-xs">Muted</Badge>}
              {deafened && <Badge variant="secondary" className="text-xs">Deafened</Badge>}
              {speaking && !muted && <Badge variant="default" className="text-xs bg-green-600">Speaking</Badge>}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function VoiceChannel({ channelId, channelName, className }: VoiceChannelProps) {
  const { user } = useCurrentUser();
  const {
    voiceState,
    isConnected,
    connectionStatus,
    isMuted,
    isDeafened,
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
    toggleDeafen,
    isJoining,
    isLeaving,
    actualConnectionCount,
  } = useVoiceChannel(channelId);

  const memberCount = voiceState?.members.length || 0;
  const isUserInChannel = voiceState?.members.some(member => member.pubkey === user?.pubkey);

  const handleJoinLeave = async () => {
    if (isConnected || isUserInChannel) {
      await leaveVoiceChannel();
    } else {
      await joinVoiceChannel();
    }
  };

  return (
    <div className={cn("rounded-lg p-4 space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Volume2 className="w-5 h-5 text-green-500" />
          <div>
            <h3 className="font-medium">{channelName}</h3>
            <p className="text-xs text-muted-foreground">
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
              {connectionStatus === 'connecting' && ' • Connecting...'}
              {isConnected && ` • Connected (${actualConnectionCount || 0} peers)`}
              {!isConnected && connectionStatus === 'connected' && ' • Reconnecting...'}
            </p>
          </div>
        </div>

        {/* Join/Leave Button */}
        <Button
          variant={isConnected || isUserInChannel ? "destructive" : "ghost"}
          size="sm"
          onClick={handleJoinLeave}
          disabled={isJoining || isLeaving || connectionStatus === 'connecting'}
          className={`min-w-[90px] ${
            isConnected || isUserInChannel
              ? ''
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {isJoining || connectionStatus === 'connecting' ? (
            "Joining..."
          ) : isLeaving ? (
            "Leaving..."
          ) : isConnected || isUserInChannel ? (
            <>
              <PhoneOff className="w-4 h-4 mr-2" />
              Leave
            </>
          ) : (
            <>
              <Phone className="w-4 h-4 mr-2" />
              Join
            </>
          )}
        </Button>
      </div>

      {/* Members List */}
      {memberCount > 0 && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-muted-foreground">In Voice</h4>
          <div className="space-y-1">
            {voiceState?.members.map((member) => (
              <VoiceMember
                key={member.pubkey}
                pubkey={member.pubkey}
                muted={member.muted}
                deafened={member.deafened}
                speaking={member.speaking}
              />
            ))}
          </div>
        </div>
      )}

      {/* Voice Controls (only show if connected) */}
      {(isConnected || isUserInChannel) && (
        <div className="flex items-center justify-center space-x-2 pt-3 mt-1 border-t border-gray-600/50">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleMute()}
                  className={`w-10 h-10 ${
                    isMuted
                      ? 'text-red-400 bg-red-400/20 hover:bg-red-400/30'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
                  }`}
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isMuted ? 'Unmute' : 'Mute'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleDeafen()}
                  className={`w-10 h-10 ${
                    isDeafened
                      ? 'text-red-400 bg-red-400/20 hover:bg-red-400/30'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
                  }`}
                >
                  {isDeafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isDeafened ? 'Undeafen' : 'Deafen'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <VoiceControls className="w-10 h-10" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Voice Settings</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}