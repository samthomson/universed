import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUserStatus, useUpdateUserStatus, useClearUserStatus, TraditionalStatus, getTraditionalStatusText } from '@/hooks/useUserStatus';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface UserStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Common emoji suggestions for status
const emojiSuggestions = [
  '😊', '😎', '🎯', '💼', '🏠', '✈️', '🎮', '📚', 
  '🎨', '🎵', '🏃', '🧘', '☕', '🍕', '🎉', '💻',
  '🔥', '⭐', '🌟', '✨', '🚀', '💪', '🎭', '🎪'
];

const traditionalStatuses: { value: TraditionalStatus; label: string; color: string }[] = [
  { value: 'online', label: 'Online', color: 'bg-green-500' },
  { value: 'busy', label: 'Busy', color: 'bg-red-500' },
  { value: 'away', label: 'Away', color: 'bg-yellow-500' },
  { value: 'offline', label: 'Offline', color: 'bg-gray-500' },
];

export function UserStatusDialog({ open, onOpenChange }: UserStatusDialogProps) {
  const { user } = useCurrentUser();
  const { data: currentStatus } = useUserStatus(user?.pubkey);
  const { mutate: updateStatus, isPending: isUpdating } = useUpdateUserStatus();
  const { mutate: clearStatus, isPending: isClearing } = useClearUserStatus();

  const [activeTab, setActiveTab] = useState<'traditional' | 'custom'>(
    currentStatus?.emoji ? 'custom' : 'traditional'
  );
  
  // Traditional status state
  const [selectedTraditionalStatus, setSelectedTraditionalStatus] = useState<TraditionalStatus | undefined>(
    currentStatus?.status
  );
  
  // Custom status state
  const [selectedEmoji, setSelectedEmoji] = useState(currentStatus?.emoji || '');
  const [customMessage, setCustomMessage] = useState(currentStatus?.message || '');
  const [customEmoji, setCustomEmoji] = useState('');

  const handleSave = () => {
    if (activeTab === 'traditional') {
      updateStatus({
        status: selectedTraditionalStatus,
        message: customMessage.trim() || undefined,
      });
    } else {
      const emoji = selectedEmoji || customEmoji;
      updateStatus({
        emoji: emoji || undefined,
        message: customMessage.trim() || undefined,
      });
    }
    onOpenChange(false);
  };

  const handleClear = () => {
    clearStatus();
    setSelectedTraditionalStatus(undefined);
    setSelectedEmoji('');
    setCustomEmoji('');
    setCustomMessage('');
    onOpenChange(false);
  };

  const handleEmojiSelect = (emoji: string) => {
    setSelectedEmoji(emoji);
    setCustomEmoji('');
  };

  const handleCustomEmojiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomEmoji(value);
    if (value) {
      setSelectedEmoji('');
    }
  };

  const isPending = isUpdating || isClearing;
  const hasChanges = activeTab === 'traditional' 
    ? selectedTraditionalStatus !== currentStatus?.status || 
      customMessage !== (currentStatus?.message || '')
    : selectedEmoji !== (currentStatus?.emoji || '') || 
      customMessage !== (currentStatus?.message || '') ||
      customEmoji !== '';

  // Generate dialog title based on current status
  const getDialogTitle = () => {
    if (currentStatus?.message) {
      return `Set Status - ${currentStatus.message}`;
    }
    if (currentStatus?.emoji) {
      return `Set Status - Custom`;
    }
    if (currentStatus?.status) {
      return `Set Status - ${getTraditionalStatusText(currentStatus.status)}`;
    }
    return 'Set Status';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'traditional' | 'custom')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="traditional">Traditional</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>

          <TabsContent value="traditional" className="space-y-6">
            <div className="space-y-3">
              <Label>Status</Label>
              <div className="grid grid-cols-2 gap-2">
                {traditionalStatuses.map((status) => (
                  <Button
                    key={status.value}
                    type="button"
                    variant={selectedTraditionalStatus === status.value ? "default" : "outline"}
                    onClick={() => setSelectedTraditionalStatus(status.value)}
                    className="flex items-center space-x-2 justify-start"
                  >
                    <div className={`w-3 h-3 rounded-full ${status.color}`} />
                    <span>{status.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Message (optional for traditional status) */}
            <div className="space-y-2">
              <Label htmlFor="traditional-message">Status Message (optional)</Label>
              <div className="flex space-x-2">
                <Input
                  id="traditional-message"
                  placeholder="Add a custom message..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  maxLength={100}
                />
                {customMessage && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCustomMessage('')}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {customMessage.length}/100 characters
              </p>
            </div>
          </TabsContent>

          <TabsContent value="custom" className="space-y-6">
            {/* Emoji Selection */}
            <div className="space-y-3">
              <Label>Status Emoji</Label>
              
              {/* Custom Emoji Input */}
              <div className="space-y-2">
                <Input
                  placeholder="Or type your own emoji..."
                  value={customEmoji}
                  onChange={handleCustomEmojiChange}
                  maxLength={2}
                  className="text-center text-lg"
                />
              </div>

              {/* Emoji Suggestions */}
              <div className="grid grid-cols-8 gap-2">
                {emojiSuggestions.map((emoji) => (
                  <Button
                    key={emoji}
                    type="button"
                    variant={selectedEmoji === emoji ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleEmojiSelect(emoji)}
                    className="text-lg p-2 h-10 w-10"
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Message */}
            <div className="space-y-2">
              <Label htmlFor="custom-message">Status Message (optional)</Label>
              <div className="flex space-x-2">
                <Input
                  id="custom-message"
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
                    onClick={() => setCustomMessage('')}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {customMessage.length}/100 characters
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Current Status Preview */}
        {(hasChanges || currentStatus?.status || currentStatus?.emoji || currentStatus?.message) && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Preview:</p>
            <div className="flex items-center space-x-2">
              {activeTab === 'traditional' ? (
                <>
                  {selectedTraditionalStatus ? (
                    <div className={`w-3 h-3 rounded-full ${
                      traditionalStatuses.find(s => s.value === selectedTraditionalStatus)?.color || 'bg-gray-500'
                    }`} />
                  ) : (
                    <span className="text-lg">●</span>
                  )}
                  <span className="text-sm">
                    {selectedTraditionalStatus 
                      ? traditionalStatuses.find(s => s.value === selectedTraditionalStatus)?.label
                      : 'No status'
                    }
                    {customMessage && ` - ${customMessage}`}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-lg">
                    {(selectedEmoji || customEmoji) || currentStatus?.emoji || '●'}
                  </span>
                  <span className="text-sm">
                    {customMessage || currentStatus?.message || 'Custom status'}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            disabled={isPending || (!currentStatus?.status && !currentStatus?.emoji && !currentStatus?.message)}
          >
            Clear Status
          </Button>
          <div className="flex space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending || (!hasChanges && activeTab === 'traditional' && !selectedTraditionalStatus) || 
                        (!hasChanges && activeTab === 'custom' && !selectedEmoji && !customEmoji && !customMessage)}
            >
              {isPending ? 'Saving...' : 'Save Status'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}