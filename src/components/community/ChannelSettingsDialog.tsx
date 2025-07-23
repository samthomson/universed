import { useState, useEffect } from 'react';
import { Trash2, Lock, Unlock, Hash, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/useToast';
import { useCanModerate } from '@/hooks/useCommunityRoles';
import { useUpdateChannel, useDeleteChannel } from '@/hooks/useChannels';
import { useChannelFolders } from '@/hooks/useChannelFolders';
import { useChannelPermissions, useUpdateChannelPermissions } from '@/hooks/useChannelPermissions';
import { useAuthor } from '@/hooks/useAuthor';
import { DeletionConfirmDialog } from '@/components/moderation/DeletionConfirmDialog';
import type { Channel } from '@/hooks/useChannels';

interface ChannelSettingsDialogProps {
  channel: Channel;
  communityId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function ChannelSettingsDialog({
  channel,
  communityId,
  open,
  onOpenChange,
  trigger
}: ChannelSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState('general');
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description || '');
  const [type, setType] = useState<'text' | 'voice'>(channel.type);
  const [folderId, setFolderId] = useState(channel.folderId || 'none');
  const [position, setPosition] = useState(channel.position);
  const [readPermissions, setReadPermissions] = useState<'everyone' | 'members' | 'moderators' | 'specific'>('everyone');
  const [writePermissions, setWritePermissions] = useState<'everyone' | 'members' | 'moderators' | 'specific'>('members');
  const [allowedReaders, setAllowedReaders] = useState<string[]>([]);
  const [allowedWriters, setAllowedWriters] = useState<string[]>([]);
  const [deniedReaders, setDeniedReaders] = useState<string[]>([]);
  const [deniedWriters, setDeniedWriters] = useState<string[]>([]);
  const [newUserPubkey, setNewUserPubkey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { toast } = useToast();
  const { canModerate } = useCanModerate(communityId);
  const { mutateAsync: updateChannel } = useUpdateChannel(communityId);
  const { mutateAsync: deleteChannel } = useDeleteChannel(communityId);
  const { data: folders } = useChannelFolders(communityId);
  const { data: permissions } = useChannelPermissions(communityId, channel.id);
  const { mutateAsync: updatePermissions } = useUpdateChannelPermissions(communityId, channel.id);

  // Load permissions when they're available
  useEffect(() => {
    if (permissions) {
      setReadPermissions(permissions.readPermissions);
      setWritePermissions(permissions.writePermissions);
      setAllowedReaders(permissions.allowedReaders);
      setAllowedWriters(permissions.allowedWriters);
      setDeniedReaders(permissions.deniedReaders);
      setDeniedWriters(permissions.deniedWriters);
    }
  }, [permissions]);

  if (!canModerate) {
    return null;
  }

  const handleUpdateGeneral = async () => {
    if (!name.trim()) {
      toast({
        title: "Channel name required",
        description: "Please enter a name for the channel.",
        variant: "destructive",
      });
      return;
    }

    const channelName = name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    if (channelName.length < 1 || channelName.length > 100) {
      toast({
        title: "Invalid channel name",
        description: "Channel name must be between 1 and 100 characters and contain only letters, numbers, hyphens, and underscores.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await updateChannel({
        channelId: channel.id,
        name: channelName,
        description: description.trim(),
        type,
        folderId: folderId !== 'none' ? folderId : undefined,
        position,
      });

      toast({
        title: "Channel updated",
        description: `#${channelName} has been updated successfully.`,
      });
    } catch (error) {
      console.error('Failed to update channel:', error);
      toast({
        title: "Failed to update channel",
        description: "There was an error updating the channel. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePermissions = async () => {
    setIsSubmitting(true);

    try {
      await updatePermissions({
        readPermissions,
        writePermissions,
        allowedReaders,
        allowedWriters,
        deniedReaders,
        deniedWriters,
      });

      toast({
        title: "Permissions updated",
        description: `Permissions for #${channel.name} have been updated.`,
      });
    } catch (error) {
      console.error('Failed to update permissions:', error);
      toast({
        title: "Failed to update permissions",
        description: "There was an error updating the permissions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteChannel = async (_reason?: string) => {
    setIsSubmitting(true);

    try {
      await deleteChannel({
        channelEventId: channel.event.id,
        channelName: channel.name,
      });

      toast({
        title: "Channel deleted",
        description: `#${channel.name} has been deleted.`,
      });

      onOpenChange?.(false);
    } catch (error) {
      console.error('Failed to delete channel:', error);
      toast({
        title: "Failed to delete channel",
        description: "There was an error deleting the channel. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addUserToList = (list: string[], setList: (list: string[]) => void) => {
    if (!newUserPubkey.trim()) return;

    const pubkey = newUserPubkey.trim();
    if (!list.includes(pubkey)) {
      setList([...list, pubkey]);
    }
    setNewUserPubkey('');
  };

  const removeUserFromList = (list: string[], setList: (list: string[]) => void, pubkey: string) => {
    setList(list.filter(p => p !== pubkey));
  };

  const UserList = ({ users, onRemove }: { users: string[]; onRemove: (pubkey: string) => void }) => (
    <div className="space-y-2">
      {users.map((pubkey) => (
        <UserBadge key={pubkey} pubkey={pubkey} onRemove={() => onRemove(pubkey)} />
      ))}
    </div>
  );

  const UserBadge = ({ pubkey, onRemove }: { pubkey: string; onRemove: () => void }) => {
    const author = useAuthor(pubkey);
    const displayName = author.data?.metadata?.name || `${pubkey.slice(0, 8)}...`;

    return (
      <Badge variant="secondary" className="flex items-center gap-2">
        {displayName}
        <Button
          variant="ghost"
          size="sm"
          className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
          onClick={onRemove}
        >
          ×
        </Button>
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === 'text' ? <Hash className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            {channel.name} Settings
          </DialogTitle>
          <DialogDescription>
            Manage channel settings, permissions, and organization.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
            <TabsTrigger value="danger">Danger Zone</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px] mt-4">
            <TabsContent value="general" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="channel-name">Channel Name</Label>
                <Input
                  id="channel-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  disabled={channel.name === 'general'}
                />
                {channel.name === 'general' && (
                  <p className="text-xs text-muted-foreground">
                    The general channel name cannot be changed.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="channel-description">Description</Label>
                <Textarea
                  id="channel-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Channel Type</Label>
                <RadioGroup
                  value={type}
                  onValueChange={(value) => setType(value as 'text' | 'voice')}
                  className="flex space-x-4"
                  disabled={isSubmitting}
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
                <Label htmlFor="folder">Folder</Label>
                <Select value={folderId} onValueChange={setFolderId}>
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
                />
                <p className="text-xs text-muted-foreground">
                  Lower numbers appear first in the channel list.
                </p>
              </div>

              <Button onClick={handleUpdateGeneral} disabled={isSubmitting} className="w-full">
                {isSubmitting ? 'Updating...' : 'Update Channel'}
              </Button>
            </TabsContent>

            <TabsContent value="permissions" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Unlock className="w-4 h-4" />
                    Read Permissions
                  </Label>
                  <Select value={readPermissions} onValueChange={(value: 'everyone' | 'members' | 'moderators' | 'specific') => setReadPermissions(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="everyone">Everyone</SelectItem>
                      <SelectItem value="members">Community Members</SelectItem>
                      <SelectItem value="moderators">Moderators Only</SelectItem>
                      <SelectItem value="specific">Specific Users</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Write Permissions
                  </Label>
                  <Select value={writePermissions} onValueChange={(value: 'everyone' | 'members' | 'moderators' | 'specific') => setWritePermissions(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="everyone">Everyone</SelectItem>
                      <SelectItem value="members">Community Members</SelectItem>
                      <SelectItem value="moderators">Moderators Only</SelectItem>
                      <SelectItem value="specific">Specific Users</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(readPermissions === 'specific' || writePermissions === 'specific') && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Add User by Public Key</Label>
                        <div className="flex gap-2">
                          <Input
                            value={newUserPubkey}
                            onChange={(e) => setNewUserPubkey(e.target.value)}
                            placeholder="Enter user's public key (npub or hex)"
                          />
                        </div>
                      </div>

                      {readPermissions === 'specific' && (
                        <div className="space-y-2">
                          <Label>Allowed Readers</Label>
                          <div className="flex gap-2 mb-2">
                            <Button
                              size="sm"
                              onClick={() => addUserToList(allowedReaders, setAllowedReaders)}
                              disabled={!newUserPubkey.trim()}
                            >
                              Add Reader
                            </Button>
                          </div>
                          <UserList users={allowedReaders} onRemove={(pubkey) => removeUserFromList(allowedReaders, setAllowedReaders, pubkey)} />
                        </div>
                      )}

                      {writePermissions === 'specific' && (
                        <div className="space-y-2">
                          <Label>Allowed Writers</Label>
                          <div className="flex gap-2 mb-2">
                            <Button
                              size="sm"
                              onClick={() => addUserToList(allowedWriters, setAllowedWriters)}
                              disabled={!newUserPubkey.trim()}
                            >
                              Add Writer
                            </Button>
                          </div>
                          <UserList users={allowedWriters} onRemove={(pubkey) => removeUserFromList(allowedWriters, setAllowedWriters, pubkey)} />
                        </div>
                      )}

                      <Separator />

                      <div className="space-y-2">
                        <Label>Denied Users</Label>
                        <p className="text-xs text-muted-foreground">
                          Users in this list will be explicitly denied access, overriding other permissions.
                        </p>
                        <div className="flex gap-2 mb-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => addUserToList(deniedReaders, setDeniedReaders)}
                            disabled={!newUserPubkey.trim()}
                          >
                            Deny Read
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => addUserToList(deniedWriters, setDeniedWriters)}
                            disabled={!newUserPubkey.trim()}
                          >
                            Deny Write
                          </Button>
                        </div>

                        {deniedReaders.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-sm">Denied Readers</Label>
                            <UserList users={deniedReaders} onRemove={(pubkey) => removeUserFromList(deniedReaders, setDeniedReaders, pubkey)} />
                          </div>
                        )}

                        {deniedWriters.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-sm">Denied Writers</Label>
                            <UserList users={deniedWriters} onRemove={(pubkey) => removeUserFromList(deniedWriters, setDeniedWriters, pubkey)} />
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <Button onClick={handleUpdatePermissions} disabled={isSubmitting} className="w-full">
                  {isSubmitting ? 'Updating...' : 'Update Permissions'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="danger" className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Trash2 className="w-5 h-5 text-destructive" />
                    <h3 className="font-semibold text-destructive">Delete Channel</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Permanently delete this channel and all its messages. This action cannot be undone.
                  </p>
                  {channel.name === 'general' ? (
                    <p className="text-sm text-muted-foreground">
                      The general channel cannot be deleted.
                    </p>
                  ) : (
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={isSubmitting}
                    >
                      Delete Channel
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>

      {/* Channel Deletion Confirmation */}
      <DeletionConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Channel"
        description={`Are you sure you want to delete #${channel.name}?`}
        itemName={channel.name}
        itemType="channel"
        warningMessage="All messages in this channel will be permanently lost."
        requireConfirmation={true}
        onConfirm={handleDeleteChannel}
        isDeleting={isSubmitting}
      />
    </Dialog>
  );
}