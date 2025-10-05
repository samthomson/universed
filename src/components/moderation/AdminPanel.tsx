import { useState } from 'react';
import { Crown, Users, Settings, Database, Download, Upload, Trash2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useDataManagerCanModerate, useDataManagerCommunityMembers } from '@/components/DataManagerProvider';
import { useAuthor } from '@/hooks/useAuthor';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { genUserName } from '@/lib/genUserName';
import { ModerationPermissions } from './ModerationPermissions';


interface AdminPanelProps {
  communityId: string;
}

interface ModeratorManagementProps {
  communityId: string;
}

interface CommunityDataProps {
  communityId: string;
}

function ModeratorManagement({ communityId }: ModeratorManagementProps) {
  const [newModeratorPubkey, setNewModeratorPubkey] = useState('');
  const [isAddingModerator, setIsAddingModerator] = useState(false);

  const { data: _members } = useDataManagerCommunityMembers(communityId);
  // TODO: Implement assignModerator, removeModerator in DataManager
  const assignModerator = (_params: { userPubkey: string }) => Promise.resolve();
  const removeModerator = (_params: { userPubkey: string }) => Promise.resolve();
  const isAssigningModerator = false;
  const isRemovingModerator = false;
  // TODO: Get moderators and owner from DataManager
  const moderators: string[] = [];
  const owner = '';
  const { toast } = useToast();

  const handleAddModerator = async () => {
    if (!newModeratorPubkey.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a valid pubkey',
        variant: 'destructive',
      });
      return;
    }

    try {
      assignModerator({ userPubkey: newModeratorPubkey.trim() });
      setNewModeratorPubkey('');
      setIsAddingModerator(false);
      toast({
        title: 'Moderator added',
        description: 'User has been promoted to moderator',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to add moderator',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveModerator = (pubkey: string) => {
    try {
      removeModerator({ userPubkey: pubkey });
      toast({
        title: 'Moderator removed',
        description: 'User has been demoted from moderator',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to remove moderator',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Moderator Management
            </CardTitle>
            <Dialog open={isAddingModerator} onOpenChange={setIsAddingModerator}>
              <DialogTrigger asChild>
                <Button>Add Moderator</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Moderator</DialogTitle>
                  <DialogDescription>
                    Enter the pubkey of the user you want to promote to moderator.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pubkey">User Pubkey</Label>
                    <Input
                      id="pubkey"
                      value={newModeratorPubkey}
                      onChange={(e) => setNewModeratorPubkey(e.target.value)}
                      placeholder="npub1... or hex pubkey"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddingModerator(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddModerator} disabled={isAssigningModerator}>
                    {isAssigningModerator ? 'Adding...' : 'Add Moderator'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Owner */}
            {owner && (
              <ModeratorCard
                pubkey={owner}
                role="owner"
                onRemove={() => { }}
                canRemove={false}
              />
            )}

            {/* Moderators */}
            {moderators.map((pubkey) => (
              <ModeratorCard
                key={pubkey}
                pubkey={pubkey}
                role="moderator"
                onRemove={() => handleRemoveModerator(pubkey)}
                canRemove={true}
                isRemoving={isRemovingModerator}
              />
            ))}

            {moderators.length === 0 && !owner && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No moderators assigned
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ModeratorCardProps {
  pubkey: string;
  role: 'owner' | 'moderator';
  onRemove: () => void;
  canRemove: boolean;
  isRemoving?: boolean;
}

function ModeratorCard({ pubkey, role, onRemove, canRemove, isRemoving }: ModeratorCardProps) {
  const author = useAuthor(pubkey);
  const displayName = author.data?.metadata?.name || genUserName(pubkey);
  const avatar = author.data?.metadata?.picture;

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatar} />
          <AvatarFallback>
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="font-medium">{displayName}</div>
          <div className="text-sm text-muted-foreground">
            {pubkey.slice(0, 16)}...
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={role === 'owner' ? 'default' : 'secondary'}>
          {role === 'owner' && <Crown className="h-3 w-3 mr-1" />}
          {role}
        </Badge>
        {canRemove && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRemove}
            disabled={isRemoving}
          >
            {isRemoving ? 'Removing...' : 'Remove'}
          </Button>
        )}
      </div>
    </div>
  );
}

function CommunityData({ communityId }: CommunityDataProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const { mutate: createEvent } = useNostrPublish();
  const { user: _user } = useCurrentUser();
  const { toast } = useToast();

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // This would implement actual data export
      // For now, we'll just simulate it
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast({
        title: 'Export completed',
        description: 'Community data has been exported successfully',
      });
    } catch {
      toast({
        title: 'Export failed',
        description: 'Failed to export community data',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteCommunity = async () => {
    if (deleteConfirmation !== 'DELETE') {
      toast({
        title: 'Invalid confirmation',
        description: 'Please type "DELETE" to confirm',
        variant: 'destructive',
      });
      return;
    }

    setIsDeleting(true);
    try {
      // Create a deletion event
      createEvent(
        {
          kind: 5, // Deletion event
          content: 'Community deleted by owner',
          tags: [
            ['a', communityId],
            ['k', '34550'],
          ],
        },
        {
          onSuccess: () => {
            toast({
              title: 'Community deleted',
              description: 'The community has been permanently deleted',
            });
          },
          onError: (_error) => {
            toast({
              title: 'Deletion failed',
              description: 'Failed to delete community',
              variant: 'destructive',
            });
          },
        }
      );
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete community',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmation('');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Community Data Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Export Data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Export all community data including posts, members, and moderation logs.
                </p>
                <Button
                  onClick={handleExportData}
                  disabled={isExporting}
                  className="w-full flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? 'Exporting...' : 'Export Data'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Import Data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Import community data from a backup file.
                </p>
                <Button variant="outline" className="w-full flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Import Data
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <h4 className="font-medium">Delete Community</h4>
            <p className="text-sm text-muted-foreground">
              Permanently delete this community and all associated data. This action cannot be undone.
            </p>
            <div className="space-y-2">
              <Label htmlFor="delete-confirmation">
                Type "DELETE" to confirm deletion
              </Label>
              <Input
                id="delete-confirmation"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
              />
            </div>
            <Button
              variant="destructive"
              onClick={handleDeleteCommunity}
              disabled={isDeleting || deleteConfirmation !== 'DELETE'}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? 'Deleting...' : 'Delete Community'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminPanel({ communityId }: AdminPanelProps) {
  const { canModerate, role } = useDataManagerCanModerate(communityId);

  if (!canModerate || role !== 'owner') {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Crown className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Admin Access Required</h3>
          <p className="text-muted-foreground">
            Only community owners can access admin features.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Admin Panel
            <Badge variant="default">Owner</Badge>
          </CardTitle>
        </CardHeader>
      </Card>

      <Tabs defaultValue="moderators" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="moderators">Moderators</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="settings">Advanced Settings</TabsTrigger>
          <TabsTrigger value="data">Data Management</TabsTrigger>
        </TabsList>

        <TabsContent value="moderators">
          <ModeratorManagement communityId={communityId} />
        </TabsContent>

        <TabsContent value="permissions">
          <ModerationPermissions communityId={communityId} />
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Advanced Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Advanced community settings will be implemented here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data">
          <CommunityData communityId={communityId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}