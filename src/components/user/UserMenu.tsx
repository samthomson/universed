import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserStatusDialog } from "@/components/user/UserStatusDialog";
import { useSettings, SETTINGS_TABS } from "@/contexts/settings.tsx";
import { ProfileModal } from "@/components/user/ProfileModal";
import LoginDialog from "@/components/auth/LoginDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, UserIcon, UserPlus, User, Settings, MessageSquare, Database } from "lucide-react";
import { RelaySelector } from "@/components/RelaySelector";
import { useLoggedInAccounts } from "@/hooks/useLoggedInAccounts";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { genUserName } from "@/lib/genUserName";
import { DataManagerDebugModal } from "@/components/debug/DataManagerDebugModal";
import { useState } from "react";

interface UserMenuProps {
  trigger: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

export function UserMenu({
  trigger,
  side = "right",
  align = "end",
  sideOffset = 10
}: UserMenuProps) {
  const { user } = useCurrentUser();
  const { currentUser, otherUsers, setLogin, removeLogin } = useLoggedInAccounts();

  const [showProfileModal, setShowProfileModal] = useState(false);
  const { openSettings } = useSettings();
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);

  if (!user) return null;

  const getDisplayName = (account: typeof currentUser) => {
    return account?.metadata.name ?? genUserName(account?.pubkey || '');
  };

  const hasMultipleAccounts = otherUsers.length > 0;

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          {trigger}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className='w-56 p-2 animate-scale-in'
          side={side}
          align={align}
          sideOffset={sideOffset}
        >
          {/* My Profile - First option */}
          <DropdownMenuItem
            onClick={() => setShowProfileModal(true)}
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
            onClick={() => openSettings()}
            className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
          >
            <Settings className='w-4 h-4' />
            <span>Settings</span>
          </DropdownMenuItem>

          {/* Debug DataManager - Development only */}
          {process.env.NODE_ENV === 'development' && (
            <DropdownMenuItem
              onClick={() => setShowDebugModal(true)}
              className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
            >
              <Database className='w-4 h-4' />
              <span>Debug DataManager</span>
            </DropdownMenuItem>
          )}

          {/* Switch Account section - Only show if multiple accounts */}
          {hasMultipleAccounts && (
            <>
              <DropdownMenuSeparator />
              <div className='font-medium text-sm px-2 py-1.5'>Switch Account</div>
              {otherUsers.map((userAccount) => (
                <DropdownMenuItem
                  key={userAccount.id}
                  onClick={() => setLogin(userAccount.id)}
                  className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
                >
                  <Avatar className='w-8 h-8'>
                    <AvatarImage src={userAccount.metadata.picture} alt={getDisplayName(userAccount)} />
                    <AvatarFallback>{getDisplayName(userAccount)?.charAt(0) || <UserIcon />}</AvatarFallback>
                  </Avatar>
                  <div className='flex-1 truncate'>
                    <p className='text-sm font-medium'>{getDisplayName(userAccount)}</p>
                  </div>
                  {userAccount.id === currentUser?.id && <div className='w-2 h-2 rounded-full bg-primary'></div>}
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

      {/* Profile Modal */}
      <ProfileModal
        open={showProfileModal}
        onOpenChange={setShowProfileModal}
        onOpenSettings={() => {
          setShowProfileModal(false);
          openSettings(SETTINGS_TABS.PROFILE);
        }}
      />

      {/* Status Dialog */}
      <UserStatusDialog
        open={showStatusDialog}
        onOpenChange={setShowStatusDialog}
      />



      {/* Login Dialog */}
      <LoginDialog
        isOpen={showLoginDialog}
        onClose={() => setShowLoginDialog(false)}
        onLogin={() => setShowLoginDialog(false)}
      />

      {/* Debug DataManager Modal */}
      <DataManagerDebugModal
        open={showDebugModal}
        onOpenChange={setShowDebugModal}
      />
    </>
  );
}