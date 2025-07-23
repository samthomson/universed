import { useState } from 'react';
import { Plus, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useQueryClient } from '@tanstack/react-query';

interface CreateResourceFolderDialogProps {
  communityId: string;
  trigger?: React.ReactNode;
}

interface ResourceFolderData {
  name: string;
  description: string;
  image: string;
  addPermission: 'admins' | 'moderators' | 'members';
  tags: string[];
}

const PERMISSION_OPTIONS = [
  { value: 'admins', label: 'Admins Only', description: 'Only community owner can add resources' },
  { value: 'moderators', label: 'Admins + Moderators', description: 'Community owner and moderators can add resources' },
  { value: 'members', label: 'Any Member', description: 'All community members can add resources' },
];

export function CreateResourceFolderDialog({ communityId, trigger }: CreateResourceFolderDialogProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ResourceFolderData>({
    name: '',
    description: '',
    image: '',
    addPermission: 'moderators',
    tags: [],
  });
  const [newTag, setNewTag] = useState('');

  const { user } = useCurrentUser();
  const { mutate: createEvent, isPending: isPublishing } = useNostrPublish();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to create a resource folder.",
        variant: "destructive",
      });
      return;
    }

    if (!data.name.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a name for your resource folder.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Generate a unique identifier for this folder
      const folderId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create tags for the event
      const tags = [
        ['d', folderId], // Required d tag with folder ID
        ['a', communityId], // Community reference
        ['title', data.name.trim()],
        ['add_permission', data.addPermission], // Who can add resources to this folder
      ];

      // Add description if provided
      if (data.description.trim()) {
        tags.push(['description', data.description.trim()]);
      }

      // Add image if provided
      if (data.image.trim()) {
        tags.push(['image', data.image.trim()]);
      }

      // Add hashtags
      data.tags.forEach(tag => {
        tags.push(['t', tag]);
      });

      // Create the resource folder event (kind 30004 - curation set, repurposed for folders)
      createEvent({
        kind: 30004,
        content: '', // Content is empty for folder definitions
        tags,
      }, {
        onSuccess: () => {
          toast({
            title: "Folder created successfully!",
            description: "Your resource folder has been added to the community.",
          });
          
          // Invalidate resource folders query to refresh the list
          queryClient.invalidateQueries({
            queryKey: ['resource-folders', communityId],
          });
          
          setOpen(false);
          // Reset form
          setData({
            name: '',
            description: '',
            image: '',
            addPermission: 'moderators',
            tags: [],
          });
          setNewTag('');
        },
        onError: (error) => {
          toast({
            title: "Failed to create folder",
            description: error.message || "An error occurred while creating your folder.",
            variant: "destructive",
          });
        },
      });
    } catch {
      toast({
        title: "Failed to create folder",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const addTag = () => {
    const tag = newTag.trim().toLowerCase();
    if (tag && !data.tags.includes(tag)) {
      setData(prev => ({
        ...prev,
        tags: [...prev.tags, tag],
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  };

  const defaultTrigger = (
    <Button className="bg-green-600 hover:bg-green-700 text-white">
      <Plus className="w-4 h-4 mr-2" />
      Create Folder
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white flex items-center">
            <Folder className="w-5 h-5 mr-2 text-green-400" />
            Create Resource Folder
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-gray-200">Folder Name *</Label>
              <Input
                id="name"
                value={data.name}
                onChange={(e) => setData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter folder name"
                className="bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
                required
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-gray-200">Description</Label>
              <Textarea
                id="description"
                value={data.description}
                onChange={(e) => setData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this folder is for..."
                rows={3}
                className="bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
              />
            </div>

            <div>
              <Label htmlFor="image" className="text-gray-200">Folder Icon URL</Label>
              <Input
                id="image"
                type="url"
                value={data.image}
                onChange={(e) => setData(prev => ({ ...prev, image: e.target.value }))}
                placeholder="https://example.com/icon.jpg"
                className="bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-4">
            <Label className="text-gray-200">Who can add resources to this folder?</Label>
            <Select 
              value={data.addPermission} 
              onValueChange={(value: 'admins' | 'moderators' | 'members') => 
                setData(prev => ({ ...prev, addPermission: value }))
              }
            >
              <SelectTrigger className="bg-gray-700 border-gray-600 text-gray-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                {PERMISSION_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-gray-400">{option.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-4">
            <Label className="text-gray-200">Tags (optional)</Label>
            
            <div className="flex space-x-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a tag"
                className="bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <Button
                type="button"
                onClick={addTag}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                Add
              </Button>
            </div>

            {data.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-600 text-gray-200"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 text-gray-400 hover:text-gray-200"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPublishing || !user}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isPublishing ? 'Creating...' : 'Create Folder'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}