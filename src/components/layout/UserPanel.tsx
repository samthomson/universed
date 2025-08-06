import { Mic, MicOff, Headphones, HeadphonesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserStatusIndicator } from "@/components/user/UserStatusIndicator";
import { UserStatusDialog } from "@/components/user/UserStatusDialog";
import { UserSettingsDialog } from "@/components/user/UserSettingsDialog";
import { ProfileModal } from "@/components/user/ProfileModal";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";
import { useUserStatus, getTraditionalStatusText } from "@/hooks/useUserStatus";
import { genUserName } from "@/lib/genUserName";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useVoiceMuteState, useVoiceDeafenState, useVoiceConnectionState } from "@/contexts/VoiceContext";
import { useState } from "react";

export function UserPanel() {
  const isMobile = useIsMobile();
  const { user } = useCurrentUser();
  const author = useAuthor(user?.pubkey || '');
  const metadata = author.data?.metadata;
  const { data: userStatus } = useUserStatus(user?.pubkey);

  const { isMuted, toggleMute } = useVoiceMuteState();
  const { isDeafened, toggleDeafen } = useVoiceDeafenState();
  const { isConnectedToVoice: _isConnectedToVoice } = useVoiceConnectionState();

  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  if (!user) return null;

  const displayName = metadata?.name || genUserName(user.pubkey);
  const profileImage = metadata?.picture;

  const handleOpenProfileModal = () => {
    setShowProfileModal(true);
  };

  return (
    <>
      <div className={`${isMobile ? 'h-14' : 'h-16'} bg-gray-800 border-t border-gray-600 flex items-center justify-between ${isMobile ? 'px-3' : 'px-2'}`}>
        {/* User Info */}
        <div
          className={`flex items-center ${isMobile ? 'space-x-3' : 'space-x-2'} flex-1 min-w-0 cursor-pointer hover:bg-gray-700/50 rounded p-1 transition-colors mobile-touch`}
          onClick={handleOpenProfileModal}
        >
          <div className="relative">
            <Avatar className={isMobile ? "w-9 h-9" : "w-8 h-8"}>
              <AvatarImage src={profileImage} alt={displayName} />
              <AvatarFallback className="bg-indigo-600 text-white text-xs">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1">
              <UserStatusIndicator pubkey={user.pubkey} />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className={`${isMobile ? 'text-base' : 'text-sm'} font-medium text-white truncate`}>
              {displayName}
            </div>
            <div className={`${isMobile ? 'text-sm' : 'text-xs'} text-gray-400 truncate`}>
              {userStatus?.message || (userStatus?.emoji ? 'Set status' : (userStatus?.status ? getTraditionalStatusText(userStatus.status) : 'Click to set status'))}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className={`flex items-center ${isMobile ? 'space-x-2' : 'space-x-1'}`}>
          {/* Voice Controls - Hide some on mobile to save space */}
          {!isMobile && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={`w-8 h-8 ${isMuted ? 'text-red-400 bg-red-400/20' : 'text-gray-400 hover:text-gray-300'}`}
                onClick={toggleMute}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className={`w-8 h-8 ${isDeafened ? 'text-red-400 bg-red-400/20' : 'text-gray-400 hover:text-gray-300'}`}
                onClick={toggleDeafen}
                title={isDeafened ? "Undeafen" : "Deafen"}
              >
                {isDeafened ? <HeadphonesIcon className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Profile Modal */}
      <ProfileModal
        open={showProfileModal}
        onOpenChange={setShowProfileModal}
        onOpenSettings={() => setShowSettingsDialog(true)}
      />

      {/* Status Dialog */}
      <UserStatusDialog
        open={showStatusDialog}
        onOpenChange={setShowStatusDialog}
      />

      {/* Settings Dialog */}
      <UserSettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
      />
    </>
  );
}