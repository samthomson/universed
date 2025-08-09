import { ReactNode, useState } from 'react';
import { MessageCircle, UserPlus, UserMinus, Shield, ShieldOff, Copy, ExternalLink, Flag } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIsFriend } from '@/hooks/useFriends';
import { useManageFriends } from '@/hooks/useManageFriends';
import { useIsMuted } from '@/hooks/useMutedUsers';
import { useManageMutedUsers } from '@/hooks/useManageMutedUsers';
import { useToast } from '@/hooks/useToast';
import { useNavigate } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { ReportUserDialog } from '@/components/reporting/ReportUserDialog';
import { useCommunityContext } from '@/contexts/communityHooks';
import { useUserRole } from '@/hooks/useCommunityRoles';

interface UserContextMenuProps {
  children: ReactNode;
  pubkey: string;
  displayName?: string;
  onStartDM?: (pubkey: string) => void;
}

export function UserContextMenu({ children, pubkey, displayName, onStartDM }: UserContextMenuProps) {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentCommunityId } = useCommunityContext();
  const { role } = useUserRole(currentCommunityId || '');
  const isAdmin = role === 'owner' || role === 'admin';

  const isFriend = useIsFriend(pubkey);
  const isMuted = useIsMuted(pubkey);
  const { addFriend, removeFriend } = useManageFriends();
  const { muteUser, unmuteUser } = useManageMutedUsers();

  const [showReportDialog, setShowReportDialog] = useState(false);

  // Don't show context menu for current user
  if (user?.pubkey === pubkey) {
    return <>{children}</>;
  }

  const handleCopyNpub = () => {
    const npub = nip19.npubEncode(pubkey);
    navigator.clipboard.writeText(npub);
    toast({
      title: 'Copied to clipboard',
      description: 'User public key copied to clipboard',
    });
  };

  const handleViewProfile = () => {
    const npub = nip19.npubEncode(pubkey);
    navigate(`/${npub}`);
  };

  const handleAddFriend = async () => {
    try {
      await addFriend({ pubkey, petname: displayName });
    } catch {
      // Error handled in hook
    }
  };

  const handleRemoveFriend = async () => {
    try {
      await removeFriend(pubkey);
    } catch {
      // Error handled in hook
    }
  };

  const handleMuteUser = async () => {
    try {
      await muteUser(pubkey);
    } catch {
      // Error handled in hook
    }
  };

  const handleUnmuteUser = async () => {
    try {
      await unmuteUser(pubkey);
    } catch {
      // Error handled in hook
    }
  };

  const handleStartDM = () => {
    if (onStartDM) {
      onStartDM(pubkey);
    } else {
      // TODO: Navigate to DM or open DM dialog
      toast({
        title: 'Feature coming soon',
        description: 'Direct messaging from context menu will be available soon',
      });
    }
  };

  const handleReportUser = () => {
    setShowReportDialog(true);
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {/* Profile Actions */}
          <ContextMenuItem onClick={handleViewProfile}>
            <ExternalLink className="w-4 h-4 mr-2" />
            View Profile
          </ContextMenuItem>

          <ContextMenuItem onClick={handleStartDM}>
            <MessageCircle className="w-4 h-4 mr-2" />
            Send Message
          </ContextMenuItem>

          <ContextMenuSeparator />

          {/* Friend Actions */}
          {isFriend ? (
            <ContextMenuItem onClick={handleRemoveFriend}>
              <UserMinus className="w-4 h-4 mr-2" />
              Remove Friend
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onClick={handleAddFriend}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add Friend
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />

          {/* Admin Actions - Only show for owners and admins */}
          {isAdmin && (
            <>
              {isMuted ? (
                <ContextMenuItem onClick={handleUnmuteUser}>
                  <ShieldOff className="w-4 h-4 mr-2" />
                  Unmute User
                </ContextMenuItem>
              ) : (
                <ContextMenuItem onClick={handleMuteUser} className="text-red-600 focus:text-red-600">
                  <Shield className="w-4 h-4 mr-2" />
                  Mute User
                </ContextMenuItem>
              )}
            </>
          )}

          {/* Report Action */}
          <ContextMenuItem onClick={handleReportUser} className="text-red-600 focus:text-red-600">
            <Flag className="w-4 h-4 mr-2" />
            Report User
          </ContextMenuItem>

          <ContextMenuSeparator />

          {/* Copy Actions */}
          <ContextMenuItem onClick={handleCopyNpub}>
            <Copy className="w-4 h-4 mr-2" />
            Copy User Public Key
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Report User Dialog */}
      <ReportUserDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        targetPubkey={pubkey}
        targetDisplayName={displayName}
        communityId={currentCommunityId || undefined}
      />
    </>
  );
}