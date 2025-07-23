import { useState } from 'react';
import { Trash2, Shield, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import { useCanModerate } from '@/hooks/useCommunityRoles';
import { useBulkDeleteMessages } from '@/hooks/useMessageActions';
import { useAuthor } from '@/hooks/useAuthor';
import type { NostrEvent } from '@nostrify/nostrify';

interface BulkMessageDeletionProps {
  messages: NostrEvent[];
  communityId: string;
  trigger?: React.ReactNode;
  onComplete?: () => void;
}

interface MessagePreview {
  event: NostrEvent;
  selected: boolean;
}

export function BulkMessageDeletion({
  messages,
  communityId,
  trigger,
  onComplete
}: BulkMessageDeletionProps) {
  const [open, setOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [messageSelection, setMessageSelection] = useState<MessagePreview[]>([]);
  const [reason, setReason] = useState('');
  const [selectAll, setSelectAll] = useState(false);

  const { toast } = useToast();
  const { canModerate } = useCanModerate(communityId);
  const { mutate: bulkDeleteMessages, isPending } = useBulkDeleteMessages(communityId);

  // Initialize message selection when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setMessageSelection(messages.map(event => ({ event, selected: false })));
      setSelectAll(false);
      setReason('');
    }
  };

  if (!canModerate) {
    return null;
  }

  const selectedMessages = messageSelection.filter(m => m.selected);
  const selectedCount = selectedMessages.length;

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setMessageSelection(prev => 
      prev.map(m => ({ ...m, selected: checked }))
    );
  };

  const handleSelectMessage = (eventId: string, checked: boolean) => {
    setMessageSelection(prev => 
      prev.map(m => 
        m.event.id === eventId ? { ...m, selected: checked } : m
      )
    );
    
    // Update select all state
    const newSelection = messageSelection.map(m => 
      m.event.id === eventId ? { ...m, selected: checked } : m
    );
    setSelectAll(newSelection.every(m => m.selected));
  };

  const handleBulkDelete = () => {
    if (selectedCount === 0) {
      toast({
        title: "No messages selected",
        description: "Please select at least one message to delete.",
        variant: "destructive",
      });
      return;
    }
    setShowConfirmDialog(true);
  };

  const confirmBulkDelete = () => {
    const messagesToDelete = selectedMessages.map(m => m.event);
    
    bulkDeleteMessages(
      { messageEvents: messagesToDelete, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast({
            title: "Messages deleted",
            description: `Successfully deleted ${selectedCount} message${selectedCount === 1 ? '' : 's'}.`,
          });
          setShowConfirmDialog(false);
          setOpen(false);
          onComplete?.();
        },
        onError: (error) => {
          console.error('Failed to bulk delete messages:', error);
          toast({
            title: "Failed to delete messages",
            description: "There was an error deleting the messages. Please try again.",
            variant: "destructive",
          });
        }
      }
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Bulk Message Deletion
            </DialogTitle>
            <DialogDescription>
              Select messages to delete as a moderator. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Select All */}
            <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/50">
              <Checkbox
                id="select-all"
                checked={selectAll}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all" className="flex items-center gap-2 cursor-pointer">
                {selectAll ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                Select All ({messages.length} messages)
              </Label>
              {selectedCount > 0 && (
                <Badge variant="secondary">
                  {selectedCount} selected
                </Badge>
              )}
            </div>

            {/* Message List */}
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {messageSelection.map(({ event, selected }) => (
                  <MessageItem
                    key={event.id}
                    event={event}
                    selected={selected}
                    onSelectionChange={(checked) => handleSelectMessage(event.id, checked)}
                  />
                ))}
              </div>
            </ScrollArea>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="bulk-delete-reason">Reason for deletion (optional)</Label>
              <Textarea
                id="bulk-delete-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why these messages are being deleted..."
                className="min-h-[80px]"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">
                {reason.length}/500 characters
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={selectedCount === 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete {selectedCount} Message{selectedCount === 1 ? '' : 's'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Confirm Bulk Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to delete {selectedCount} message{selectedCount === 1 ? '' : 's'} as a moderator. 
              This action cannot be undone and will be logged in the moderation history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmBulkDelete}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {isPending ? 'Deleting...' : 'Delete Messages'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface MessageItemProps {
  event: NostrEvent;
  selected: boolean;
  onSelectionChange: (checked: boolean) => void;
}

function MessageItem({ event, selected, onSelectionChange }: MessageItemProps) {
  const author = useAuthor(event.pubkey);
  const displayName = author.data?.metadata?.name || `${event.pubkey.slice(0, 8)}...`;
  
  // Truncate long messages
  const truncatedContent = event.content.length > 100 
    ? `${event.content.slice(0, 100)}...` 
    : event.content;

  return (
    <div className={`flex items-start space-x-3 p-3 border rounded-lg transition-colors ${
      selected ? 'bg-muted border-primary' : 'hover:bg-muted/50'
    }`}>
      <Checkbox
        checked={selected}
        onCheckedChange={onSelectionChange}
        className="mt-1"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{displayName}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(event.created_at * 1000).toLocaleString()}
          </span>
        </div>
        <p className="text-sm text-muted-foreground break-words">
          {truncatedContent}
        </p>
      </div>
    </div>
  );
}