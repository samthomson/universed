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
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { useCommunities } from '@/hooks/useCommunities';
import { useUserMembership } from '@/hooks/useUserMembership';

interface CreateChannelDialogProps {
  communityId: string;
  onChannelCreated?: () => void;
}

export function CreateChannelDialog({ communityId, onChannelCreated }: CreateChannelDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'text' | 'voice'>('text');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useCurrentUser();
  const { mutateAsync: createEvent } = useNostrPublish();
  const { toast } = useToast();
  const { data: communities } = useCommunities();
  const { data: memberships } = useUserMembership();

  // Check if user has permission to create channels
  const community = communities?.find(c => c.id === communityId);
  const membership = memberships?.find(m => m.communityId === communityId);

  const canCreateChannel = user && community && (
    // User is the community creator
    community.creator === user.pubkey ||
    // User is a moderator
    community.moderators.includes(user.pubkey) ||
    // User has owner/moderator membership status
    membership?.status === 'owner' ||
    membership?.status === 'moderator'
  );

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
      await createEvent({
        kind: 32807, // Custom kind for channel definition
        content: JSON.stringify({
          name: channelName,
          description: description.trim() || undefined,
          type,
        }),
        tags: [
          ['d', `${communityId}:${channelName}`], // Unique identifier: community:channel
          ['a', communityId], // Reference to community
          ['name', channelName],
          ['description', description.trim()],
          ['channel_type', type],
          ['t', 'channel'], // Tag for filtering
        ],
      });

      toast({
        title: "Channel created",
        description: `#${channelName} has been created successfully.`,
      });

      // Reset form
      setName('');
      setDescription('');
      setType('text');
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
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-gray-400 hover:text-gray-300 h-8"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Channel
        </Button>
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