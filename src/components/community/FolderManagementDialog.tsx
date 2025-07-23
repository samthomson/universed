import { useState } from 'react';
import { Folder, Edit, Trash2, GripVertical } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/useToast';
import { useCanModerate } from '@/hooks/useCommunityRoles';
import {
  useChannelFolders,
  useCreateChannelFolder,
  useUpdateChannelFolder,
  useDeleteChannelFolder,
  type ChannelFolder
} from '@/hooks/useChannelFolders';

interface FolderManagementDialogProps {
  communityId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

interface FolderFormData {
  name: string;
  description: string;
  position: number;
}

export function FolderManagementDialog({
  communityId,
  open,
  onOpenChange,
  trigger
}: FolderManagementDialogProps) {
  const [editingFolder, setEditingFolder] = useState<ChannelFolder | null>(null);
  const [formData, setFormData] = useState<FolderFormData>({
    name: '',
    description: '',
    position: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();
  const { canModerate } = useCanModerate(communityId);
  const { data: folders, refetch } = useChannelFolders(communityId);
  const { mutateAsync: createFolder } = useCreateChannelFolder(communityId);
  const { mutateAsync: updateFolder } = useUpdateChannelFolder(communityId);
  const { mutateAsync: deleteFolder } = useDeleteChannelFolder(communityId);

  if (!canModerate) {
    return null;
  }

  const resetForm = () => {
    setFormData({ name: '', description: '', position: 0 });
    setEditingFolder(null);
  };

  const startEdit = (folder: ChannelFolder) => {
    setEditingFolder(folder);
    setFormData({
      name: folder.name,
      description: folder.description || '',
      position: folder.position,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: "Folder name required",
        description: "Please enter a name for the folder.",
        variant: "destructive",
      });
      return;
    }

    const folderName = formData.name.trim();
    if (folderName.length < 1 || folderName.length > 100) {
      toast({
        title: "Invalid folder name",
        description: "Folder name must be between 1 and 100 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingFolder) {
        await updateFolder({
          folderId: editingFolder.id,
          name: folderName,
          description: formData.description.trim(),
          position: formData.position,
        });

        toast({
          title: "Folder updated",
          description: `"${folderName}" has been updated successfully.`,
        });
      } else {
        await createFolder({
          name: folderName,
          description: formData.description.trim(),
          position: formData.position,
        });

        toast({
          title: "Folder created",
          description: `"${folderName}" has been created successfully.`,
        });
      }

      resetForm();
      refetch();
    } catch (error) {
      console.error('Failed to save folder:', error);
      toast({
        title: editingFolder ? "Failed to update folder" : "Failed to create folder",
        description: "There was an error saving the folder. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (folder: ChannelFolder) => {
    if (!confirm(`Are you sure you want to delete the "${folder.name}" folder? Channels in this folder will be moved to the root level.`)) {
      return;
    }

    setIsSubmitting(true);

    try {
      await deleteFolder({
        folderEventId: folder.event.id,
      });

      toast({
        title: "Folder deleted",
        description: `"${folder.name}" has been deleted.`,
      });

      refetch();
    } catch (error) {
      console.error('Failed to delete folder:', error);
      toast({
        title: "Failed to delete folder",
        description: "There was an error deleting the folder. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getNextPosition = () => {
    if (!folders || folders.length === 0) return 0;
    return Math.max(...folders.map(f => f.position)) + 1;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[500px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="w-5 h-5" />
            Manage Channel Folders
          </DialogTitle>
          <DialogDescription>
            Create and organize folders to group your channels, just like Discord.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Create/Edit Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">
                {editingFolder ? 'Edit Folder' : 'Create New Folder'}
              </Label>
              <Input
                id="folder-name"
                placeholder="Folder name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                maxLength={100}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="folder-description">Description (Optional)</Label>
              <Textarea
                id="folder-description"
                placeholder="What's this folder for?"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                maxLength={500}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="folder-position">Position</Label>
              <Input
                id="folder-position"
                type="number"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: parseInt(e.target.value) || 0 })}
                min={0}
                placeholder={getNextPosition().toString()}
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers appear first in the folder list.
              </p>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? (editingFolder ? 'Updating...' : 'Creating...')
                  : (editingFolder ? 'Update Folder' : 'Create Folder')
                }
              </Button>
              {editingFolder && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>

          <Separator />

          {/* Existing Folders */}
          <div className="space-y-2">
            <Label>Existing Folders</Label>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {folders && folders.length > 0 ? (
                  folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{folder.name}</div>
                          {folder.description && (
                            <div className="text-sm text-muted-foreground">
                              {folder.description}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Position: {folder.position}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(folder)}
                          disabled={isSubmitting}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(folder)}
                          disabled={isSubmitting}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Folder className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No folders created yet</p>
                    <p className="text-sm">Create your first folder to organize channels</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}