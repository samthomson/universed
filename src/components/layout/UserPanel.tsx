import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserStatusIndicator } from "@/components/user/UserStatusIndicator";
import { UserMenu } from "@/components/user/UserMenu";
import { Settings } from "lucide-react";
import { useUserStatus, getTraditionalStatusText } from "@/hooks/useUserStatus";
import { genUserName } from "@/lib/genUserName";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useVoiceConnectionState } from "@/contexts/voiceHooks";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";

export function UserPanel() {
  const isMobile = useIsMobile();
  const { user } = useCurrentUser();
  const author = useAuthor(user?.pubkey || '');
  const metadata = author.data?.metadata;
  const { data: userStatus } = useUserStatus(user?.pubkey);
  const { isConnectedToVoice: _isConnectedToVoice } = useVoiceConnectionState();

  if (!user) return null;

  const displayName = metadata?.name || genUserName(user.pubkey);
  const profileImage = metadata?.picture;

  return (
    <div className={`${isMobile ? 'h-20' : 'h-24'} flex items-center justify-between ${isMobile ? 'px-5' : 'px-4'} bg-gray-800/50 hover:bg-gray-700/50 transition-colors`}>
      {/* User Info */}
      <UserMenu
        trigger={
          <button
            className={`flex items-center ${isMobile ? 'space-x-3' : 'space-x-2'} flex-1 min-w-0 cursor-pointer transition-colors mobile-touch bg-transparent border-none text-left`}
            type="button"
          >
            <div className="relative">
              <Avatar className={isMobile ? "w-12 h-12" : "w-11 h-11"}>
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
            <Settings className="w-6 h-6 text-gray-400" />
          </button>
        }
        side="top"
        align="start"
        sideOffset={8}
      />
    </div>
  );
}