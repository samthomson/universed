import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserStatusIndicator } from "@/components/user/UserStatusIndicator";
import { UserStatusDialog } from "@/components/user/UserStatusDialog";
import { UserSettingsDialog } from "@/components/user/UserSettingsDialog";
import { ProfileModal } from "@/components/user/ProfileModal";
import LoginDialog from "@/components/auth/LoginDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, UserIcon, UserPlus, User, Settings, MessageSquare } from "lucide-react";
import { RelaySelector } from "@/components/RelaySelector";
import { useLoggedInAccounts } from "@/hooks/useLoggedInAccounts";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";
import { useUserStatus, getTraditionalStatusText } from "@/hooks/useUserStatus";
import { genUserName } from "@/lib/genUserName";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useVoiceConnectionState } from "@/contexts/voiceHooks";
import { useState } from "react";

export function UserPanel() {
  const isMobile = useIsMobile();
  const { user } = useCurrentUser();
  const author = useAuthor(user?.pubkey || '');
  const metadata = author.data?.metadata;
  const { data: userStatus } = useUserStatus(user?.pubkey);
  const { isConnectedToVoice: _isConnectedToVoice } = useVoiceConnectionState();
  const { currentUser, otherUsers, setLogin, removeLogin } = useLoggedInAccounts();

  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  if (!user) return null;

  const displayName = metadata?.name || genUserName(user.pubkey);
  const profileImage = metadata?.picture;

  const handleOpenProfileModal = () => {
    setShowProfileModal(true);
  };

  const getDisplayName = (account: typeof currentUser) => {
    return account?.metadata.name ?? genUserName(account?.pubkey || '');
  };

  const hasMultipleAccounts = otherUsers.length > 0;

  return (
    <>
      <div className={`${isMobile ? 'h-14' : 'h-16'} flex items-center justify-between ${isMobile ? 'px-3' : 'px-2'}`}>
        {/* User Info */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              className={`flex items-center ${isMobile ? 'space-x-3' : 'space-x-2'} flex-1 min-w-0 cursor-pointer hover:bg-gray-700/50 rounded p-1 transition-colors mobile-touch bg-transparent border-none text-left`}
              type="button"
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
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className='w-56 p-2 animate-scale-in'>
            {/* My Profile - First option */}
            <DropdownMenuItem
              onClick={handleOpenProfileModal}
              className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
            >
              <User className='w-4 h-4' />
              <span>My Profile</span>
            </DropdownMenuItem>

            {/* Status Switcher - Second option */}
            <DropdownMenuItem
              onClick={() => setShowStatusDialog(true)}
              className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
            >
              <MessageSquare className='w-4 h-4' />
              <span>Set Status</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <div className='font-medium text-sm px-2 py-1.5'>Switch Relay</div>
            <RelaySelector className="w-full" />

            <DropdownMenuSeparator />

            {/* User Settings */}
            <DropdownMenuItem
              onClick={() => setShowSettingsDialog(true)}
              className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
            >
              <Settings className='w-4 h-4' />
              <span>User Settings</span>
            </DropdownMenuItem>

            {/* Switch Account section - Only show if multiple accounts */}
            {hasMultipleAccounts && (
              <>
                <DropdownMenuSeparator />
                <div className='font-medium text-sm px-2 py-1.5'>Switch Account</div>
                {otherUsers.map((user) => (
                  <DropdownMenuItem
                    key={user.id}
                    onClick={() => setLogin(user.id)}
                    className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
                  >
                    <Avatar className='w-8 h-8'>
                      <AvatarImage src={user.metadata.picture} alt={getDisplayName(user)} />
                      <AvatarFallback>{getDisplayName(user)?.charAt(0) || <UserIcon />}</AvatarFallback>
                    </Avatar>
                    <div className='flex-1 truncate'>
                      <p className='text-sm font-medium'>{getDisplayName(user)}</p>
                    </div>
                    {user.id === currentUser?.id && <div className='w-2 h-2 rounded-full bg-primary'></div>}
                  </DropdownMenuItem>
                ))}
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setShowLoginDialog(true)}
              className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
            >
              <UserPlus className='w-4 h-4' />
              <span>Add another account</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => currentUser && removeLogin(currentUser.id)}
              className='flex items-center gap-2 cursor-pointer p-2 rounded-md text-red-500'
            >
              <LogOut className='w-4 h-4' />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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

      {/* Login Dialog */}
      <LoginDialog
        isOpen={showLoginDialog}
        onClose={() => setShowLoginDialog(false)}
        onLogin={() => setShowLoginDialog(false)}
      />
    </>
  );
}