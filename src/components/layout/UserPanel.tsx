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
import { useSettings } from "@/contexts/settings.tsx";

export function UserPanel() {
  const isMobile = useIsMobile();
  const { user } = useCurrentUser();
  const author = useAuthor(user?.pubkey || '');
  const metadata = author.data?.metadata;
  const { data: userStatus } = useUserStatus(user?.pubkey);
  const { isConnectedToVoice: _isConnectedToVoice } = useVoiceConnectionState();
  const { openSettings } = useSettings();

  if (!user) return null;

  const displayName = metadata?.name || genUserName(user.pubkey);
  const profileImage = metadata?.picture;

  return (
    <div className={`${isMobile ? 'h-16' : 'h-16'} flex items-center`}>
      {/* User Menu Trigger - Left Part Only */}
      <UserMenu
        trigger={
          <div className={`flex items-center ${isMobile ? 'space-x-4' : 'space-x-3'} flex-1 min-w-0 ${isMobile ? 'px-5' : 'px-4'} hover:bg-sidebar-accent transition-colors cursor-pointer h-full`}>
            <div className="relative">
              <Avatar className={isMobile ? "w-12 h-12" : "w-11 h-11"}>
                <AvatarImage src={profileImage} alt={displayName} />
                <AvatarFallback className="bg-nostr-purple text-nostr-purple-foreground text-xs">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1">
                <UserStatusIndicator pubkey={user.pubkey} />
              </div>
            </div>

            <div className="flex-1 min-w-0 ml-3">
              <div className={`${isMobile ? 'text-base' : 'text-sm'} font-medium text-sidebar-foreground truncate`}>
                {displayName}
              </div>
              <div className={`${isMobile ? 'text-sm' : 'text-xs'} text-muted-foreground truncate`}>
                {userStatus?.message || (userStatus?.emoji ? 'Set status' : (userStatus?.status ? getTraditionalStatusText(userStatus.status) : 'Click to set status'))}
              </div>
            </div>
          </div>
        }
        side="top"
        align="start"
        sideOffset={8}
      />
      
      {/* Settings Button - Separate from UserMenu */}
      <div 
        className={`${isMobile ? 'h-16' : 'h-16'} flex items-center justify-center w-16 hover:bg-sidebar-accent/50 transition-colors cursor-pointer`} 
        onClick={(e) => {
          e.stopPropagation();
          openSettings();
        }}
      >
        <Settings className="w-5 h-5 text-sidebar-foreground/70" />
      </div>
    </div>
  );
}