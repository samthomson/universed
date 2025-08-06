import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, HeadphonesIcon, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { VoiceControls } from './VoiceControls';
import { useVoiceChannel } from '@/hooks/useVoiceChannel';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useVoiceMuteState, useVoiceDeafenState, useVoiceSpeakingState, useVoiceConnectionState } from '@/contexts/VoiceContext';
import { genUserName } from '@/lib/genUserName';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

interface VoiceChannelProps {
  channelId: string;
  channelName: string;
  className?: string;
}

// Helper function to determine grid layout based on participant count
function getVoiceGridLayout(memberCount: number) {
  if (memberCount === 0) return '';

  if (memberCount === 1) {
    return 'flex items-center justify-center';
  }

  if (memberCount === 2) {
    return 'grid grid-cols-1 sm:grid-cols-2 gap-4';
  }

  // For 3+ participants, create responsive grid
  if (memberCount <= 4) {
    return 'grid grid-cols-2 gap-4';
  }

  if (memberCount <= 9) {
    return 'grid grid-cols-2 sm:grid-cols-3 gap-4';
  }

  if (memberCount <= 16) {
    return 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4';
  }

  // For larger groups
  return 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4';
}

// Helper function to determine card sizing based on participant count
function getVoiceCardSize(memberCount: number) {
  if (memberCount === 1) {
    return 'w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 max-w-[300px] max-h-[300px]';
  }

  if (memberCount === 2) {
    return 'w-full max-w-[200px] max-h-[200px] aspect-square';
  }

  if (memberCount <= 4) {
    return 'w-full max-w-[180px] max-h-[180px] aspect-square';
  }

  if (memberCount <= 9) {
    return 'w-full max-w-[160px] max-h-[160px] aspect-square';
  }

  return 'w-full max-w-[140px] max-h-[140px] aspect-square';
}

function VoiceMember({
  pubkey,
  muted,
  deafened,
  speaking,
  cardSize,
  memberCount,
  currentUserMuted,
  currentUserDeafened,
  currentUserSpeaking,
  currentUserPubkey
}: {
  pubkey: string;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  cardSize?: string;
  memberCount: number;
  currentUserMuted?: boolean;
  currentUserDeafened?: boolean;
  currentUserSpeaking?: boolean;
  currentUserPubkey?: string;
}) {
  const author = useAuthor(pubkey);
  const displayName = author.data?.metadata?.name || genUserName(pubkey);
  const profileImage = author.data?.metadata?.picture;

  // For the current user, use the passed-in current user state
  // For other users, use the props from voiceState.members
  const isCurrentUser = currentUserPubkey === pubkey;
  const effectiveMuted = isCurrentUser ? currentUserMuted || false : muted;
  const effectiveDeafened = isCurrentUser ? currentUserDeafened || false : deafened;
  const effectiveSpeaking = isCurrentUser ? currentUserSpeaking || false : speaking;

  // Debug logging to see what values we're getting
  console.log(`VoiceMember ${pubkey.slice(0, 8)}...: isCurrentUser=${isCurrentUser}, muted=${muted}, deafened=${deafened}, speaking=${speaking}, currentUserMuted=${currentUserMuted}, currentUserDeafened=${currentUserDeafened}, effectiveMuted=${effectiveMuted}, effectiveDeafened=${effectiveDeafened}, effectiveSpeaking=${effectiveSpeaking}`);

  // Truncate display name if too long for square cards
  const truncatedName = displayName.length > 10 ? `${displayName.slice(0, 10)}...` : displayName;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "voice-card relative flex flex-col items-center justify-center",
            cardSize || "w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28",
            "rounded-xl overflow-hidden",
            "bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm",
            "hover:bg-white/20 dark:hover:bg-gray-700/60",
            "border border-white/20 dark:border-gray-600/30",
            "transition-all duration-300 ease-in-out",
            "hover:scale-105 hover:shadow-lg",
            effectiveSpeaking && !effectiveMuted && "voice-speaking",
            effectiveDeafened && "opacity-60 grayscale"
          )}>
            {/* Speaking indicator - glowing/pulsing border */}
            {effectiveSpeaking && !effectiveMuted && (
              <div className="absolute inset-0 rounded-xl bg-green-500/20 animate-pulse" />
            )}

            {/* Avatar Container - centered circular frame */}
            <div className="relative flex-shrink-0">
              <div className={cn(
                // Responsive avatar sizing based on card size
                memberCount === 1 ? "w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40" :
                memberCount === 2 ? "w-16 h-16 sm:w-20 sm:h-20" :
                memberCount <= 4 ? "w-14 h-14 sm:w-16 sm:h-16" :
                memberCount <= 9 ? "w-12 h-12 sm:w-14 sm:h-14" :
                "w-10 h-10 sm:w-12 sm:h-12",
                "rounded-full overflow-hidden",
                "ring-2 ring-white/30 dark:ring-gray-600/50",
                "transition-all duration-300 ease-in-out",
                effectiveSpeaking && !effectiveMuted && "ring-green-400 ring-offset-2 ring-offset-transparent scale-110 shadow-lg shadow-green-500/30",
                effectiveDeafened && "opacity-70"
              )}>
                <Avatar className="w-full h-full">
                  <AvatarImage
                    src={profileImage}
                    alt={displayName}
                    className="object-cover w-full h-full"
                  />
                  <AvatarFallback className="text-sm sm:text-base font-semibold bg-gradient-to-br from-blue-500 to-purple-600 text-white w-full h-full">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Status indicators - positioned at bottom right of avatar */}
              <div className="absolute -bottom-1 -right-1 flex space-x-1">
                {effectiveMuted && (
                  <div className={cn(
                    // Responsive indicator sizing
                    memberCount === 1 ? "w-6 h-6" :
                    memberCount === 2 ? "w-5 h-5" :
                    "w-4 h-4",
                    "bg-red-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-sm"
                  )}>
                    <MicOff className={cn(
                      memberCount === 1 ? "w-3 h-3" :
                      memberCount === 2 ? "w-2.5 h-2.5" :
                      "w-2 h-2",
                      "text-white"
                    )} />
                  </div>
                )}
                {effectiveDeafened && !effectiveMuted && (
                  <div className={cn(
                    // Responsive indicator sizing
                    memberCount === 1 ? "w-6 h-6" :
                    memberCount === 2 ? "w-5 h-5" :
                    "w-4 h-4",
                    "bg-gray-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-sm"
                  )}>
                    <VolumeX className={cn(
                      memberCount === 1 ? "w-3 h-3" :
                      memberCount === 2 ? "w-2.5 h-2.5" :
                      "w-2 h-2",
                      "text-white"
                    )} />
                  </div>
                )}
              </div>
            </div>

            {/* User Name - positioned at bottom of card */}
            <div className="absolute bottom-2 left-0 right-0 px-2">
              <span className={cn(
                // Responsive text sizing
                memberCount === 1 ? "text-sm sm:text-base" :
                memberCount === 2 ? "text-xs sm:text-sm" :
                memberCount <= 4 ? "text-xs" :
                "text-xs",
                "font-medium text-center leading-tight block truncate",
                "text-gray-100 dark:text-gray-100",
                "drop-shadow-md",
                effectiveDeafened && "opacity-70",
                effectiveSpeaking && !effectiveMuted && "text-green-400 dark:text-green-300 font-semibold"
              )}>
                {truncatedName}
              </span>
            </div>

            {/* Subtle overlay effect for speaking state */}
            {effectiveSpeaking && !effectiveMuted && (
              <div className="absolute inset-0 bg-gradient-to-t from-green-500/10 to-transparent rounded-xl" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{displayName}</p>
            <div className="flex space-x-2 text-xs">
              {effectiveMuted && <Badge variant="destructive" className="text-xs">Muted</Badge>}
              {effectiveDeafened && <Badge variant="secondary" className="text-xs">Deafened</Badge>}
              {effectiveSpeaking && !effectiveMuted && <Badge variant="default" className="text-xs bg-green-600">Speaking</Badge>}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function VoiceChannel({ channelId, channelName, className }: VoiceChannelProps) {
  const { user } = useCurrentUser();

  // Use shared voice state for UI and audio control
  const { isMuted, toggleMute } = useVoiceMuteState();
  const { isDeafened, toggleDeafen } = useVoiceDeafenState();
  const { isSpeaking } = useVoiceSpeakingState();
  const { setIsConnectedToVoice } = useVoiceConnectionState();

  // Get connection state and other data from useVoiceChannel
  const {
    voiceState,
    isConnected,
    connectionStatus,
    joinVoiceChannel,
    leaveVoiceChannel,
    isJoining,
    isLeaving,
    actualConnectionCount,
  } = useVoiceChannel(channelId);

  // Sync voice connection state with the shared context
  useEffect(() => {
    setIsConnectedToVoice(isConnected);
  }, [isConnected, setIsConnectedToVoice]);

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
    <div className={cn(
      "rounded-lg p-6 space-y-6",
      "bg-white/5 dark:bg-gray-900/30 backdrop-blur-sm",
      "border border-white/10 dark:border-gray-700/30",
      "min-h-[400px] max-h-[80vh]",
      className
    )}>
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

      {/* Members List - Discord-like Responsive Layout */}
      {memberCount > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground text-center">
            In Voice ({memberCount})
          </h4>

          {/* Dynamic Voice Layout */}
          <div className={cn(
            "min-h-[300px] max-h-[60vh] p-4",
            "bg-black/20 dark:bg-black/40",
            "rounded-2xl border border-white/10 dark:border-gray-600/30",
            "backdrop-blur-sm",
            getVoiceGridLayout(memberCount)
          )}>
            {voiceState?.members.map((member) => (
              <VoiceMember
                key={member.pubkey}
                pubkey={member.pubkey}
                muted={member.muted}
                deafened={member.deafened}
                speaking={member.speaking}
                cardSize={getVoiceCardSize(memberCount)}
                memberCount={memberCount}
                currentUserMuted={isMuted}
                currentUserDeafened={isDeafened}
                currentUserSpeaking={isSpeaking}
                currentUserPubkey={user?.pubkey}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {memberCount === 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground text-center">
            Voice Channel
          </h4>

          <div className={cn(
            "min-h-[300px] max-h-[60vh] p-4",
            "bg-black/20 dark:bg-black/40",
            "rounded-2xl border border-white/10 dark:border-gray-600/30",
            "backdrop-blur-sm",
            "flex items-center justify-center"
          )}>
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-full bg-gray-700/50 flex items-center justify-center">
                <Volume2 className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-400 text-sm">
                No one is in the voice channel
              </p>
              <p className="text-gray-500 text-xs">
                Click Join to connect
              </p>
            </div>
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
                  onClick={toggleMute}
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
                  onClick={toggleDeafen}
                  className={`w-10 h-10 ${
                    isDeafened
                      ? 'text-red-400 bg-red-400/20 hover:bg-red-400/30'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
                  }`}
                >
                  {isDeafened ? <HeadphonesIcon className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
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