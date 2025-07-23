import { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DeletionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  itemName: string;
  itemType: 'channel' | 'folder' | 'message' | 'messages';
  warningMessage?: string;
  requireConfirmation?: boolean;
  requireReason?: boolean;
  onConfirm: (reason?: string) => void;
  isDeleting?: boolean;
  destructiveAction?: boolean;
}

export function DeletionConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  itemName,
  itemType,
  warningMessage,
  requireConfirmation = false,
  requireReason = false,
  onConfirm,
  isDeleting = false,
  destructiveAction = true
}: DeletionConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const handleClose = () => {
    setReason('');
    setConfirmed(false);
    onOpenChange(false);
  };

  const handleConfirm = () => {
    onConfirm(requireReason ? reason.trim() || undefined : undefined);
    handleClose();
  };

  const canConfirm = (!requireConfirmation || confirmed) && (!requireReason || reason.trim());

  const getConfirmationText = () => {
    switch (itemType) {
      case 'channel':
        return `I understand that deleting "${itemName}" will permanently remove the channel and all its messages.`;
      case 'folder':
        return `I understand that deleting "${itemName}" will move all channels in this folder to the root level.`;
      case 'message':
        return `I understand that deleting this message cannot be undone.`;
      case 'messages':
        return `I understand that deleting these messages cannot be undone.`;
      default:
        return `I understand that this action cannot be undone.`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {warningMessage && (
            <div className="flex items-start gap-3 p-3 border border-amber-200 rounded-lg bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {warningMessage}
              </p>
            </div>
          )}

          {requireReason && (
            <div className="space-y-2">
              <Label htmlFor="deletion-reason">
                Reason for deletion {requireReason ? '(required)' : '(optional)'}
              </Label>
              <Textarea
                id="deletion-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={`Explain why ${itemName} is being deleted...`}
                className="min-h-[80px]"
                maxLength={500}
                required={requireReason}
              />
              <p className="text-xs text-muted-foreground text-right">
                {reason.length}/500 characters
              </p>
            </div>
          )}

          {requireConfirmation && (
            <div className="flex items-start space-x-2">
              <Checkbox
                id="confirm-deletion"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
                className="mt-1"
              />
              <Label htmlFor="confirm-deletion" className="text-sm leading-relaxed cursor-pointer">
                {getConfirmationText()}
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant={destructiveAction ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={!canConfirm || isDeleting}
          >
            {isDeleting ? (
              <>Deleting...</>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete {itemType === 'messages' ? 'Messages' : itemName}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}