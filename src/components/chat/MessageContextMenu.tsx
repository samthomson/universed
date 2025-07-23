import { useState } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDeleteMessage, useEditMessage } from '@/hooks/useMessageActions';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCanModerate } from '@/hooks/useCommunityRoles';
import type { NostrEvent } from '@nostrify/nostrify';
import { Edit, Trash2, Copy, Reply, Shield } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface MessageContextMenuProps {
  message: NostrEvent;
  children: React.ReactNode;
  onReply?: () => void;
  communityId?: string;
}

export function MessageContextMenu({ message, children, onReply, communityId }: MessageContextMenuProps) {
  const { user } = useCurrentUser();
  const { mutate: deleteMessage } = useDeleteMessage(communityId);
  const { mutate: editMessage } = useEditMessage();
  const { canModerate } = useCanModerate(communityId || '');
  const { toast } = useToast();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [deleteReason, setDeleteReason] = useState('');

  const isOwnMessage = user?.pubkey === message.pubkey;
  const canDeleteMessage = isOwnMessage || (communityId && canModerate);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content);
    toast({ title: 'Message copied to clipboard' });
  };

  const handleDeleteMessage = () => {
    deleteMessage({
      messageEvent: message,
      reason: deleteReason.trim() || undefined
    });
    setShowDeleteDialog(false);
    setDeleteReason('');
    toast({
      title: 'Message deleted',
      description: isOwnMessage ? undefined : 'Message deleted by moderator'
    });
  };

  const handleEditMessage = () => {
    if (editContent.trim() === message.content.trim()) {
      setShowEditDialog(false);
      return;
    }

    editMessage({
      originalEvent: message,
      newContent: editContent.trim()
    });
    setShowEditDialog(false);
    toast({ title: 'Message edited' });
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          {onReply && (
            <>
              <ContextMenuItem onClick={onReply}>
                <Reply className="mr-2 h-4 w-4" />
                Reply
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}

          <ContextMenuItem onClick={handleCopyMessage}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Message
          </ContextMenuItem>

          {isOwnMessage && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => setShowEditDialog(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Message
              </ContextMenuItem>
            </>
          )}

          {canDeleteMessage && (
            <>
              {!isOwnMessage && <ContextMenuSeparator />}
              <ContextMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600 focus:text-red-600"
              >
                {isOwnMessage ? (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Message
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Delete Message (Mod)
                  </>
                )}
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isOwnMessage ? (
                <>
                  <Trash2 className="w-5 h-5" />
                  Delete Message
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Delete Message (Moderator)
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {isOwnMessage
                ? "Are you sure you want to delete this message? This action cannot be undone."
                : "As a moderator, you are about to delete another user's message. This action cannot be undone."
              }
            </DialogDescription>
          </DialogHeader>

          {!isOwnMessage && (
            <div className="space-y-2">
              <Label htmlFor="delete-reason">Reason for deletion (optional)</Label>
              <Textarea
                id="delete-reason"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Explain why this message is being deleted..."
                className="min-h-[80px]"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">
                {deleteReason.length}/500 characters
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDeleteDialog(false);
              setDeleteReason('');
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteMessage}
            >
              {isOwnMessage ? 'Delete Message' : 'Delete as Moderator'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Message Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Message</DialogTitle>
            <DialogDescription>
              Make changes to your message
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Type your message..."
              className="min-h-[100px]"
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {editContent.length}/2000 characters
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditMessage}
              disabled={!editContent.trim() || editContent.trim() === message.content.trim()}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}