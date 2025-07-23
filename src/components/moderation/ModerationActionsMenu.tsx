import { useState } from 'react';
import { Shield, Trash2, Ban, VolumeX, Pin, PinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import { useCanModerate } from '@/hooks/useCommunityRoles';
import { useDeleteMessage } from '@/hooks/useMessageActions';
import { useModerationActions } from '@/hooks/useModerationActions';
import { usePinMessage, useUnpinMessage, useIsPinned } from '@/hooks/usePinnedMessages';
import { DeletionConfirmDialog } from './DeletionConfirmDialog';
import type { NostrEvent } from '@nostrify/nostrify';

interface ModerationActionsMenuProps {
  message: NostrEvent;
  communityId: string;
  channelId?: string;
  trigger?: React.ReactNode;
  variant?: 'dropdown' | 'inline';
}

export function ModerationActionsMenu({
  message,
  communityId,
  channelId,
  trigger,
  variant = 'dropdown'
}: ModerationActionsMenuProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [showMuteDialog, setShowMuteDialog] = useState(false);

  const { toast } = useToast();
  const { canModerate } = useCanModerate(communityId);
  const { mutate: deleteMessage, isPending: isDeleting } = useDeleteMessage(communityId);
  const moderationActions = useModerationActions();
  const { mutate: pinMessage } = usePinMessage();
  const { mutate: unpinMessage } = useUnpinMessage();
  const isPinned = useIsPinned(communityId, channelId || '', message.id);

  if (!canModerate) {
    return null;
  }

  const handleDeleteMessage = (reason?: string) => {
    deleteMessage(
      { messageEvent: message, reason },
      {
        onSuccess: () => {
          toast({
            title: "Message deleted",
            description: "Message deleted by moderator",
          });
        },
        onError: (error) => {
          console.error('Failed to delete message:', error);
          toast({
            title: "Failed to delete message",
            description: "There was an error deleting the message. Please try again.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const handleBanUser = (reason?: string) => {
    moderationActions.banUser.mutate(
      {
        communityId,
        userPubkey: message.pubkey,
        reason
      },
      {
        onSuccess: () => {
          toast({
            title: "User banned",
            description: "User has been banned from the community",
          });
        },
        onError: (error) => {
          console.error('Failed to ban user:', error);
          toast({
            title: "Failed to ban user",
            description: "There was an error banning the user. Please try again.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const handleMuteUser = (reason?: string) => {
    moderationActions.muteUser.mutate(
      {
        communityId,
        userPubkey: message.pubkey,
        reason
      },
      {
        onSuccess: () => {
          toast({
            title: "User muted",
            description: "User has been muted in the community",
          });
        },
        onError: (error) => {
          console.error('Failed to mute user:', error);
          toast({
            title: "Failed to mute user",
            description: "There was an error muting the user. Please try again.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const handleTogglePin = () => {
    if (!channelId) return;

    if (isPinned) {
      unpinMessage({ communityId, channelId, messageId: message.id });
    } else {
      pinMessage({ communityId, channelId, messageId: message.id });
    }
  };

  const defaultTrigger = (
    <Button variant="ghost" size="icon" className="w-8 h-8">
      <Shield className="w-4 h-4" />
    </Button>
  );

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-1">
        <Badge variant="outline" className="text-xs">
          <Shield className="w-3 h-3 mr-1" />
          Mod
        </Badge>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDeleteDialog(true)}
          className="h-6 px-2 text-xs text-red-400 hover:text-red-300"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Delete
        </Button>

        {channelId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTogglePin}
            className="h-6 px-2 text-xs"
          >
            {isPinned ? (
              <>
                <PinOff className="w-3 h-3 mr-1" />
                Unpin
              </>
            ) : (
              <>
                <Pin className="w-3 h-3 mr-1" />
                Pin
              </>
            )}
          </Button>
        )}

        {/* Deletion Dialog */}
        <DeletionConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title="Delete Message (Moderator)"
          description="You are about to delete another user's message as a moderator."
          itemName="this message"
          itemType="message"
          requireReason={true}
          onConfirm={handleDeleteMessage}
          isDeleting={isDeleting}
        />
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger || defaultTrigger}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Message
          </DropdownMenuItem>

          {channelId && (
            <DropdownMenuItem onClick={handleTogglePin}>
              {isPinned ? (
                <>
                  <PinOff className="mr-2 h-4 w-4" />
                  Unpin Message
                </>
              ) : (
                <>
                  <Pin className="mr-2 h-4 w-4" />
                  Pin Message
                </>
              )}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setShowMuteDialog(true)}>
            <VolumeX className="mr-2 h-4 w-4" />
            Mute User
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setShowBanDialog(true)}
            className="text-red-600 focus:text-red-600"
          >
            <Ban className="mr-2 h-4 w-4" />
            Ban User
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Deletion Dialog */}
      <DeletionConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Message (Moderator)"
        description="You are about to delete another user's message as a moderator."
        itemName="this message"
        itemType="message"
        requireReason={true}
        onConfirm={handleDeleteMessage}
        isDeleting={isDeleting}
      />

      {/* Ban Dialog */}
      <DeletionConfirmDialog
        open={showBanDialog}
        onOpenChange={setShowBanDialog}
        title="Ban User"
        description="You are about to ban this user from the community."
        itemName="this user"
        itemType="message"
        warningMessage="The user will be removed from the community and unable to rejoin."
        requireReason={true}
        requireConfirmation={true}
        onConfirm={handleBanUser}
        destructiveAction={true}
      />

      {/* Mute Dialog */}
      <DeletionConfirmDialog
        open={showMuteDialog}
        onOpenChange={setShowMuteDialog}
        title="Mute User"
        description="You are about to mute this user in the community."
        itemName="this user"
        itemType="message"
        warningMessage="The user will not be able to send messages in this community."
        requireReason={true}
        onConfirm={handleMuteUser}
        destructiveAction={false}
      />
    </>
  );
}