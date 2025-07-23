import { useState } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
import type { NostrEvent } from '@nostrify/nostrify';
import { Edit, Trash2, Copy, Reply } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface MessageContextMenuProps {
  message: NostrEvent;
  children: React.ReactNode;
  onReply?: () => void;
}

export function MessageContextMenu({ message, children, onReply }: MessageContextMenuProps) {
  const { user } = useCurrentUser();
  const { mutate: deleteMessage } = useDeleteMessage();
  const { mutate: editMessage } = useEditMessage();
  const { toast } = useToast();
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  
  const isOwnMessage = user?.pubkey === message.pubkey;
  
  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content);
    toast({ title: 'Message copied to clipboard' });
  };
  
  const handleDeleteMessage = () => {
    deleteMessage(message);
    setShowDeleteDialog(false);
    toast({ title: 'Message deleted' });
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
              <ContextMenuItem 
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Message
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteMessage}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
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