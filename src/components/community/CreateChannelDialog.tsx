import { useState } from 'react';
import { Hash, Volume2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { useDataManager } from '@/components/DataManagerProvider';
import { Switch } from '@/components/ui/switch';

interface CreateChannelDialogProps {
  communityId: string;
  folderId?: string; // Optional folder ID to create channel in
  defaultType?: 'text' | 'voice'; // Default channel type
  onChannelCreated?: () => void;
  trigger?: React.ReactNode; // Custom trigger element
}

export function CreateChannelDialog({
  communityId,
  folderId: initialFolderId,
  defaultType = 'text',
  onChannelCreated,
  trigger
}: CreateChannelDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'text' | 'voice'>(defaultType);
  const [selectedFolderId, setSelectedFolderId] = useState(initialFolderId || 'none');
  const [position, setPosition] = useState(0);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useCurrentUser();
  const { mutateAsync: createEvent } = useNostrPublish();
  const { toast } = useToast();
  const { communities } = useDataManager();

  // Get community from DataManager
  const community = communities.communities.get(communityId);

  // Check if user has permission to create channels
  const canCreateChannel = user && community && (
    // User is the community creator
    community.definitionEvent.pubkey === user.pubkey ||
    // User is a moderator
    community.info.moderators.includes(user.pubkey) ||
    // User has owner/moderator membership status
    community.membershipStatus === 'owner' ||
    community.membershipStatus === 'moderator'
  );

  // Get folders from DataManager
  const { getFolders } = useDataManager().communities;
  const folders = community ? getFolders(communityId) : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !canCreateChannel) {
      toast({
        title: "Permission denied",
        description: "Only community admins and moderators can create channels.",
        variant: "destructive",
      });
      return;
    }

    if (!name.trim()) {
      toast({
        title: "Channel name required",
        description: "Please enter a name for the channel.",
        variant: "destructive",
      });
      return;
    }

    // Validate channel name (similar to Discord rules)
    const channelName = name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    if (channelName.length < 1 || channelName.length > 100) {
      toast({
        title: "Invalid channel name",
        description: "Channel name must be between 1 and 100 characters and contain only letters, numbers, hyphens, and underscores.",
        variant: "destructive",
      });
      return;
    }

    // Prevent creating channels with reserved names
    const reservedNames = ['general'];
    if (reservedNames.includes(channelName)) {
      toast({
        title: "Reserved channel name",
        description: `The name "${channelName}" is reserved. Please choose a different name.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const tags = [
        ['d', channelName], // Unique identifier: just the channel name
        ['a', communityId], // Reference to community (simple community ID)
        ['name', channelName],
        ['description', description.trim()],
        ['channel_type', type],
        ['position', position.toString()],
        ['t', 'channel'], // Tag for filtering
        ['alt', `Channel: ${channelName}`],
      ];

      if (selectedFolderId && selectedFolderId !== 'none') {
        tags.push(['folder', selectedFolderId]);
      }

      await createEvent({
        kind: 32807, // Custom kind for channel definition
        content: JSON.stringify({
          name: channelName,
          description: description.trim() || undefined,
          type,
          folderId: selectedFolderId !== 'none' ? selectedFolderId : undefined,
          position,
        }),
        tags,
      });

      // Create default permissions if channel is private
      if (isPrivate) {
        const permissionTags = [
          ['d', channelName],
          ['a', communityId],
          ['channel', channelName],
          ['t', 'channel-permissions'],
          ['alt', `Channel permissions for ${channelName}`],
        ];

        await createEvent({
          kind: 30143, // Channel permissions event
          content: JSON.stringify({
            readPermissions: 'members',
            writePermissions: 'members',
          }),
          tags: permissionTags,
        });
      }

      toast({
        title: "Channel created",
        description: `#${channelName} has been created successfully.`,
      });

      // Reset form
      setName('');
      setDescription('');
      setType(defaultType);
      setSelectedFolderId(initialFolderId || 'none');
      setPosition(0);
      setIsPrivate(false);
      setOpen(false);

      // Notify parent component
      onChannelCreated?.();
    } catch (error) {
      console.error('Failed to create channel:', error);
      toast({
        title: "Failed to create channel",
        description: "There was an error creating the channel. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Don't render if user doesn't have permission
  if (!canCreateChannel) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-gray-400 hover:text-gray-300 hover:bg-gray-800/60 h-8"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Channel
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Channel</DialogTitle>
          <DialogDescription>
            Create a new channel in this community. Only admins and moderators can create channels.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel-type">Channel Type</Label>
            <RadioGroup
              value={type}
              onValueChange={(value) => setType(value as 'text' | 'voice')}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="text" id="text" />
                <Label htmlFor="text" className="flex items-center space-x-2 cursor-pointer">
                  <Hash className="w-4 h-4" />
                  <span>Text</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="voice" id="voice" />
                <Label htmlFor="voice" className="flex items-center space-x-2 cursor-pointer">
                  <Volume2 className="w-4 h-4" />
                  <span>Voice</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-name">Channel Name</Label>
            <Input
              id="channel-name"
              placeholder="announcements"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
            />
            <p className="text-xs text-muted-foreground">
              Channel names must be lowercase and can only contain letters, numbers, hyphens, and underscores.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-description">Description (Optional)</Label>
            <Textarea
              id="channel-description"
              placeholder="What's this channel about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="folder">Folder (Optional)</Label>
            <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
              <SelectTrigger>
                <SelectValue placeholder="No folder (root level)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No folder (root level)</SelectItem>
                {folders?.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Position</Label>
            <Input
              id="position"
              type="number"
              value={position}
              onChange={(e) => setPosition(parseInt(e.target.value) || 0)}
              min={0}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Lower numbers appear first in the channel list.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="private-channel"
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
            />
            <Label htmlFor="private-channel" className="text-sm font-medium">
              Private Channel
            </Label>
          </div>
          {isPrivate && (
            <p className="text-xs text-muted-foreground">
              Only community members will be able to see and write in this channel.
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Channel'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}