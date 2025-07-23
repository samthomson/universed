import { useState } from 'react';
import { Trash2, Shield, Folder, Hash, MessageSquare, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useToast } from '@/hooks/useToast';
import { useCanModerate } from '@/hooks/useCommunityRoles';
import { useChannels, useDeleteChannel } from '@/hooks/useChannels';
import { useChannelFolders, useDeleteChannelFolder } from '@/hooks/useChannelFolders';
import { useMessages } from '@/hooks/useMessages';
import { BulkMessageDeletion } from './BulkMessageDeletion';
import { DeletionConfirmDialog } from './DeletionConfirmDialog';
import { ChannelSettingsDialog } from '@/components/community/ChannelSettingsDialog';
import { FolderManagementDialog } from '@/components/community/FolderManagementDialog';
import type { Channel } from '@/hooks/useChannels';


interface ModerationDeletionPanelProps {
  communityId: string;
  channelId?: string;
}

export function ModerationDeletionPanel({ communityId, channelId }: ModerationDeletionPanelProps) {
  const [activeTab, setActiveTab] = useState('messages');
  const [channelToDelete, setChannelToDelete] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { toast } = useToast();
  const { canModerate } = useCanModerate(communityId);
  const { data: channels } = useChannels(communityId);
  const { data: folders } = useChannelFolders(communityId);
  const { data: messages } = useMessages(communityId, channelId || 'general');
  const { mutateAsync: deleteChannel } = useDeleteChannel(communityId);
  const { mutateAsync: deleteFolder } = useDeleteChannelFolder(communityId);

  if (!canModerate) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            You need moderator permissions to access deletion tools.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleDeleteChannel = async (_reason?: string) => {
    if (!channelToDelete) return;

    const channel = channels?.find(c => c.id === channelToDelete);
    if (!channel) return;

    setIsDeleting(true);

    try {
      await deleteChannel({
        channelEventId: channel.event.id,
        channelName: channel.name,
      });

      toast({
        title: "Channel deleted",
        description: `#${channel.name} has been deleted.`,
      });

      setChannelToDelete(null);
    } catch (error) {
      console.error('Failed to delete channel:', error);
      toast({
        title: "Failed to delete channel",
        description: "There was an error deleting the channel. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteFolder = async (_reason?: string) => {
    if (!folderToDelete) return;

    const folder = folders?.find(f => f.id === folderToDelete);
    if (!folder) return;

    setIsDeleting(true);

    try {
      await deleteFolder({
        folderEventId: folder.event.id,
      });

      toast({
        title: "Folder deleted",
        description: `"${folder.name}" has been deleted.`,
      });

      setFolderToDelete(null);
    } catch (error) {
      console.error('Failed to delete folder:', error);
      toast({
        title: "Failed to delete folder",
        description: "There was an error deleting the folder. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const deletableChannels = channels?.filter(c => c.name !== 'general') || [];
  const recentMessages = messages?.slice(0, 50) || [];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Moderation Deletion Tools
        </CardTitle>
        <CardDescription>
          Manage and delete community content. Use these tools responsibly.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="channels" className="flex items-center gap-2">
              <Hash className="w-4 h-4" />
              Channels
            </TabsTrigger>
            <TabsTrigger value="folders" className="flex items-center gap-2">
              <Folder className="w-4 h-4" />
              Folders
            </TabsTrigger>
          </TabsList>

          <TabsContent value="messages" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Message Management</h3>
                <p className="text-sm text-muted-foreground">
                  Delete individual messages or perform bulk operations
                </p>
              </div>
              {recentMessages.length > 0 && (
                <BulkMessageDeletion
                  messages={recentMessages}
                  communityId={communityId}
                  trigger={
                    <Button variant="destructive" size="sm">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Bulk Delete
                    </Button>
                  }
                />
              )}
            </div>

            <div className="p-4 border border-amber-200 rounded-lg bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                    Message Deletion Guidelines
                  </p>
                  <ul className="text-sm text-amber-700 dark:text-amber-300 mt-1 space-y-1">
                    <li>• Individual messages can be deleted via context menu</li>
                    <li>• Bulk deletion is available for recent messages</li>
                    <li>• All deletions are logged in moderation history</li>
                    <li>• Provide clear reasons for transparency</li>
                  </ul>
                </div>
              </div>
            </div>

            {recentMessages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No recent messages to manage</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="channels" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Channel Management</h3>
                <p className="text-sm text-muted-foreground">
                  Delete channels and manage channel structure
                </p>
              </div>
              <ChannelSettingsDialog
                channel={channels?.[0] || { id: '', name: '', type: 'text' as const, communityId, creator: '', position: 0, event: {} as Channel['event'] }}
                communityId={communityId}
                trigger={
                  <Button variant="outline" size="sm">
                    <Hash className="w-4 h-4 mr-2" />
                    Manage Channels
                  </Button>
                }
              />
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {deletableChannels.map((channel) => (
                  <div
                    key={channel.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Hash className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{channel.name}</div>
                        {channel.description && (
                          <div className="text-sm text-muted-foreground">
                            {channel.description}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {channel.type}
                          </Badge>
                          {channel.folderId && (
                            <Badge variant="secondary" className="text-xs">
                              {folders?.find(f => f.id === channel.folderId)?.name || 'Unknown Folder'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setChannelToDelete(channel.id)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {deletableChannels.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Hash className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No deletable channels</p>
                <p className="text-sm">The general channel cannot be deleted</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="folders" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Folder Management</h3>
                <p className="text-sm text-muted-foreground">
                  Delete folders and reorganize channel structure
                </p>
              </div>
              <FolderManagementDialog
                communityId={communityId}
                trigger={
                  <Button variant="outline" size="sm">
                    <Folder className="w-4 h-4 mr-2" />
                    Manage Folders
                  </Button>
                }
              />
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {folders?.map((folder) => (
                  <div
                    key={folder.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Folder className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{folder.name}</div>
                        {folder.description && (
                          <div className="text-sm text-muted-foreground">
                            {folder.description}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          Position: {folder.position}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setFolderToDelete(folder.id)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )) || []}
              </div>
            </ScrollArea>

            {(!folders || folders.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <Folder className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No folders created yet</p>
                <p className="text-sm">Create folders to organize channels</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Channel Deletion Dialog */}
      <DeletionConfirmDialog
        open={!!channelToDelete}
        onOpenChange={(open) => !open && setChannelToDelete(null)}
        title="Delete Channel"
        description={`Are you sure you want to delete #${channels?.find(c => c.id === channelToDelete)?.name}?`}
        itemName={channels?.find(c => c.id === channelToDelete)?.name || ''}
        itemType="channel"
        warningMessage="All messages in this channel will be permanently lost."
        requireConfirmation={true}
        onConfirm={handleDeleteChannel}
        isDeleting={isDeleting}
      />

      {/* Folder Deletion Dialog */}
      <DeletionConfirmDialog
        open={!!folderToDelete}
        onOpenChange={(open) => !open && setFolderToDelete(null)}
        title="Delete Folder"
        description={`Are you sure you want to delete the "${folders?.find(f => f.id === folderToDelete)?.name}" folder?`}
        itemName={folders?.find(f => f.id === folderToDelete)?.name || ''}
        itemType="folder"
        warningMessage="Channels in this folder will be moved to the root level."
        requireConfirmation={true}
        onConfirm={handleDeleteFolder}
        isDeleting={isDeleting}
      />
    </Card>
  );
}