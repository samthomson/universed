import { useState } from 'react';
import { CheckSquare, Square, Trash2, Ban, VolumeX, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useModerationActions } from '@/hooks/useModerationActions';
import { useToast } from '@/hooks/useToast';
import type { NostrEvent } from '@nostrify/nostrify';

interface BulkModerationActionsProps {
  communityId: string;
  items: Array<{
    id: string;
    type: 'post' | 'user' | 'report';
    data: { pubkey: string } | NostrEvent | { id: string };
  }>;
  onSelectionChange: (selectedIds: string[]) => void;
  selectedIds: string[];
}

interface BulkActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  action: 'delete' | 'ban' | 'mute' | 'approve' | null;
  selectedCount: number;
  onConfirm: (reason: string, duration?: number) => void;
  isProcessing: boolean;
}

function BulkActionDialog({
  isOpen,
  onClose,
  action,
  selectedCount,
  onConfirm,
  isProcessing
}: BulkActionDialogProps) {
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState<number | undefined>(undefined);

  const getActionDetails = () => {
    switch (action) {
      case 'delete':
        return {
          title: 'Delete Selected Items',
          description: `Are you sure you want to delete ${selectedCount} selected items? This action cannot be undone.`,
          color: 'destructive',
          icon: <Trash2 className="h-5 w-5" />,
        };
      case 'ban':
        return {
          title: 'Ban Selected Users',
          description: `Are you sure you want to ban ${selectedCount} selected users from the community?`,
          color: 'destructive',
          icon: <Ban className="h-5 w-5" />,
        };
      case 'mute':
        return {
          title: 'Mute Selected Users',
          description: `Are you sure you want to mute ${selectedCount} selected users?`,
          color: 'warning',
          icon: <VolumeX className="h-5 w-5" />,
        };
      case 'approve':
        return {
          title: 'Approve Selected Items',
          description: `Are you sure you want to approve ${selectedCount} selected items?`,
          color: 'success',
          icon: <CheckCircle className="h-5 w-5" />,
        };
      default:
        return {
          title: 'Bulk Action',
          description: 'Perform bulk action on selected items',
          color: 'default',
          icon: <AlertTriangle className="h-5 w-5" />,
        };
    }
  };

  const details = getActionDetails();

  const handleConfirm = () => {
    onConfirm(reason, duration);
    setReason('');
    setDuration(undefined);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {details.icon}
            {details.title}
          </DialogTitle>
          <DialogDescription>
            {details.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter a reason for this action..."
              className="min-h-[80px]"
            />
          </div>

          {(action === 'ban' || action === 'mute') && (
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Select onValueChange={(value) => setDuration(value === 'permanent' ? undefined : parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3600">1 hour</SelectItem>
                  <SelectItem value="86400">1 day</SelectItem>
                  <SelectItem value="604800">1 week</SelectItem>
                  <SelectItem value="2592000">30 days</SelectItem>
                  <SelectItem value="permanent">Permanent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            variant={details.color === 'destructive' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : `${action} ${selectedCount} items`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BulkModerationActions({
  communityId,
  items,
  onSelectionChange,
  selectedIds
}: BulkModerationActionsProps) {
  const [currentAction, setCurrentAction] = useState<'delete' | 'ban' | 'mute' | 'approve' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const {
    deletePost,
    banUser,
    muteUser,
    approvePost,
  } = useModerationActions();

  const { toast } = useToast();

  const selectedItems = items.filter(item => selectedIds.includes(item.id));
  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < items.length;

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(items.map(item => item.id));
    }
  };

  const handleBulkAction = async (action: 'delete' | 'ban' | 'mute' | 'approve', reason: string, duration?: number) => {
    setIsProcessing(true);

    try {
      const promises = selectedItems.map(async (item) => {
        switch (action) {
          case 'delete':
            if (item.type === 'post') {
              return deletePost({
                communityId,
                postId: item.id,
                reason,
              });
            }
            break;
          case 'ban':
            if (item.type === 'user') {
              return banUser({
                communityId,
                userPubkey: (item.data as { pubkey: string }).pubkey,
                reason,
                duration,
              });
            }
            break;
          case 'mute':
            if (item.type === 'user') {
              return muteUser({
                communityId,
                userPubkey: (item.data as { pubkey: string }).pubkey,
                reason,
                duration,
              });
            }
            break;
          case 'approve':
            if (item.type === 'post') {
              return approvePost({
                communityId,
                post: item.data as NostrEvent,
              });
            }
            break;
        }
      });

      await Promise.all(promises.filter(Boolean));

      toast({
        title: 'Bulk action completed',
        description: `Successfully ${action}ed ${selectedItems.length} items`,
      });

      onSelectionChange([]);
    } catch {
      toast({
        title: 'Bulk action failed',
        description: 'Some actions may have failed. Please check the logs.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setCurrentAction(null);
    }
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 text-sm font-medium"
              >
                {allSelected ? (
                  <CheckSquare className="h-4 w-4" />
                ) : someSelected ? (
                  <div className="h-4 w-4 border-2 border-primary bg-primary/20 rounded-sm flex items-center justify-center">
                    <div className="h-2 w-2 bg-primary rounded-sm" />
                  </div>
                ) : (
                  <Square className="h-4 w-4" />
                )}
                Select All ({items.length})
              </button>
              {selectedIds.length > 0 && (
                <Badge variant="secondary">
                  {selectedIds.length} selected
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>

        {selectedIds.length > 0 && (
          <CardContent>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentAction('approve')}
                className="flex items-center gap-1"
              >
                <CheckCircle className="h-3 w-3" />
                Approve ({selectedIds.length})
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentAction('delete')}
                className="flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" />
                Delete ({selectedIds.length})
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentAction('mute')}
                className="flex items-center gap-1"
              >
                <VolumeX className="h-3 w-3" />
                Mute ({selectedIds.length})
              </Button>

              <Button
                size="sm"
                variant="destructive"
                onClick={() => setCurrentAction('ban')}
                className="flex items-center gap-1"
              >
                <Ban className="h-3 w-3" />
                Ban ({selectedIds.length})
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <BulkActionDialog
        isOpen={currentAction !== null}
        onClose={() => setCurrentAction(null)}
        action={currentAction}
        selectedCount={selectedIds.length}
        onConfirm={(reason, duration) => currentAction && handleBulkAction(currentAction, reason, duration)}
        isProcessing={isProcessing}
      />
    </>
  );
}