import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useUserStatus, useUpdateUserStatus, type UserStatus } from '@/hooks/useUserStatus';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/utils';

interface UserStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusOptions = [
  { value: 'online', label: 'Online', color: 'bg-green-500', description: 'Available to chat' },
  { value: 'away', label: 'Away', color: 'bg-yellow-500', description: 'Temporarily unavailable' },
  { value: 'busy', label: 'Busy', color: 'bg-red-500', description: 'Do not disturb' },
  { value: 'offline', label: 'Offline', color: 'bg-gray-500', description: 'Appear offline' },
] as const;

export function UserStatusDialog({ open, onOpenChange }: UserStatusDialogProps) {
  const { user } = useCurrentUser();
  const { data: currentStatus } = useUserStatus(user?.pubkey);
  const { mutate: updateStatus, isPending } = useUpdateUserStatus();

  const [selectedStatus, setSelectedStatus] = useState<UserStatus['status']>(
    currentStatus?.status || 'online'
  );
  const [customMessage, setCustomMessage] = useState(currentStatus?.customMessage || '');

  const handleSave = () => {
    updateStatus({
      status: selectedStatus,
      customMessage: customMessage.trim() || undefined,
    });
    onOpenChange(false);
  };

  const handleClearMessage = () => {
    setCustomMessage('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Your Status</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Selection */}
          <div className="space-y-3">
            <Label>Status</Label>
            <RadioGroup
              value={selectedStatus}
              onValueChange={(value) => setSelectedStatus(value as UserStatus['status'])}
              className="space-y-2"
            >
              {statusOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-3">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <div className="flex items-center space-x-3 flex-1">
                    <div className={cn('w-3 h-3 rounded-full', option.color)} />
                    <div className="flex-1">
                      <Label htmlFor={option.value} className="font-medium cursor-pointer">
                        {option.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Custom Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Custom Message (optional)</Label>
            <div className="flex space-x-2">
              <Input
                id="message"
                placeholder="What's on your mind?"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                maxLength={100}
              />
              {customMessage && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearMessage}
                >
                  Clear
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {customMessage.length}/100 characters
            </p>
          </div>

          {/* Current Status Preview */}
          {(selectedStatus !== currentStatus?.status || customMessage !== (currentStatus?.customMessage || '')) && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Preview:</p>
              <div className="flex items-center space-x-2">
                <div className={cn(
                  'w-3 h-3 rounded-full',
                  statusOptions.find(opt => opt.value === selectedStatus)?.color
                )} />
                <span className="text-sm">
                  {customMessage || statusOptions.find(opt => opt.value === selectedStatus)?.label}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending ? 'Saving...' : 'Save Status'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}