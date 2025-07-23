import { useState } from 'react';
import { Plus, Link as LinkIcon, FileText, BookOpen, Globe } from 'lucide-react';
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

interface AddResourceToFolderDialogProps {
  communityId: string;
  folderId: string;
  folderName: string;
  trigger?: React.ReactNode;
}

interface ResourceData {
  type: 'url' | 'note' | 'article';
  url?: string;
  eventId?: string;
  title: string;
  description: string;
}

export function AddResourceToFolderDialog({ 
  communityId, 
  folderId, 
  folderName, 
  trigger 
}: AddResourceToFolderDialogProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ResourceData>({
    type: 'url',
    url: '',
    title: '',
    description: '',
  });

  const { user } = useCurrentUser();
  const { mutate: createEvent, isPending: isPublishing } = useNostrPublish();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to add resources.",
        variant: "destructive",
      });
      return;
    }

    if (!data.title.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a title for the resource.",
        variant: "destructive",
      });
      return;
    }

    if (data.type === 'url' && !data.url?.trim()) {
      toast({
        title: "Missing URL",
        description: "Please provide a valid URL.",
        variant: "destructive",
      });
      return;
    }

    if ((data.type === 'note' || data.type === 'article') && !data.eventId?.trim()) {
      toast({
        title: "Missing event ID",
        description: "Please provide a valid event ID or address.",
        variant: "destructive",
      });
      return;
    }

    // Validate URL format
    if (data.type === 'url' && data.url) {
      try {
        new URL(data.url);
      } catch {
        toast({
          title: "Invalid URL",
          description: "Please provide a valid URL starting with http:// or https://",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      // Generate a unique identifier for this resource
      const resourceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create the resource content
      const content = JSON.stringify({
        title: data.title.trim(),
        description: data.description.trim(),
        type: data.type,
        url: data.type === 'url' ? data.url : undefined,
        eventId: data.type !== 'url' ? data.eventId : undefined,
      });

      // Create tags for the event
      const tags = [
        ['d', resourceId], // Required d tag with resource ID
        ['a', communityId], // Community reference
        ['folder', folderId], // Folder this resource belongs to
        ['title', data.title.trim()],
        ['resource_type', data.type],
      ];

      // Add the actual resource reference based on type
      if (data.type === 'url' && data.url) {
        tags.push(['r', data.url]);
      } else if (data.type === 'note' && data.eventId) {
        tags.push(['e', data.eventId]);
      } else if (data.type === 'article' && data.eventId) {
        tags.push(['a', data.eventId]);
      }

      // Add description if provided
      if (data.description.trim()) {
        tags.push(['description', data.description.trim()]);
      }

      // Create the resource event (kind 30005 - video curation set, repurposed for individual resources)
      createEvent({
        kind: 30005,
        content,
        tags,
      }, {
        onSuccess: () => {
          toast({
            title: "Resource added successfully!",
            description: `Your resource has been added to "${folderName}".`,
          });
          
          // Invalidate resource queries to refresh the list
          queryClient.invalidateQueries({
            queryKey: ['folder-resources', communityId, folderId],
          });
          queryClient.invalidateQueries({
            queryKey: ['resource-folders', communityId],
          });
          
          setOpen(false);
          // Reset form
          setData({
            type: 'url',
            url: '',
            title: '',
            description: '',
          });
        },
        onError: (error) => {
          toast({
            title: "Failed to add resource",
            description: error.message || "An error occurred while adding your resource.",
            variant: "destructive",
          });
        },
      });
    } catch {
      toast({
        title: "Failed to add resource",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'url':
        return <Globe className="w-4 h-4" />;
      case 'note':
        return <FileText className="w-4 h-4" />;
      case 'article':
        return <BookOpen className="w-4 h-4" />;
      default:
        return <LinkIcon className="w-4 h-4" />;
    }
  };

  const defaultTrigger = (
    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
      <Plus className="w-3 h-3 mr-1" />
      Add Resource
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white">
            Add Resource to "{folderName}"
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Resource Type */}
          <div>
            <Label htmlFor="resource-type" className="text-gray-200">Resource Type</Label>
            <Select
              value={data.type}
              onValueChange={(value: 'url' | 'note' | 'article') => 
                setData(prev => ({ ...prev, type: value, url: '', eventId: '' }))
              }
            >
              <SelectTrigger className="bg-gray-700 border-gray-600 text-gray-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="url">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-4 h-4" />
                    <span>Website/URL</span>
                  </div>
                </SelectItem>
                <SelectItem value="note">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4" />
                    <span>Nostr Note</span>
                  </div>
                </SelectItem>
                <SelectItem value="article">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-4 h-4" />
                    <span>Nostr Article</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Resource Link/ID */}
          {data.type === 'url' && (
            <div>
              <Label htmlFor="resource-url" className="text-gray-200">URL *</Label>
              <Input
                id="resource-url"
                type="url"
                value={data.url || ''}
                onChange={(e) => setData(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://example.com"
                className="bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
                required
              />
            </div>
          )}

          {data.type === 'note' && (
            <div>
              <Label htmlFor="resource-event-id" className="text-gray-200">Note ID *</Label>
              <Input
                id="resource-event-id"
                value={data.eventId || ''}
                onChange={(e) => setData(prev => ({ ...prev, eventId: e.target.value }))}
                placeholder="Event ID (hex) or note1... identifier"
                className="bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                You can paste either a hex event ID or a note1... identifier
              </p>
            </div>
          )}

          {data.type === 'article' && (
            <div>
              <Label htmlFor="resource-event-id" className="text-gray-200">Article Address *</Label>
              <Input
                id="resource-event-id"
                value={data.eventId || ''}
                onChange={(e) => setData(prev => ({ ...prev, eventId: e.target.value }))}
                placeholder="30023:pubkey:identifier or naddr1... identifier"
                className="bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                You can paste either a full address (30023:pubkey:identifier) or an naddr1... identifier
              </p>
            </div>
          )}

          {/* Resource Information */}
          <div>
            <Label htmlFor="resource-title" className="text-gray-200">Title *</Label>
            <Input
              id="resource-title"
              value={data.title}
              onChange={(e) => setData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Resource title"
              className="bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
              required
            />
          </div>

          <div>
            <Label htmlFor="resource-description" className="text-gray-200">Description</Label>
            <Textarea
              id="resource-description"
              value={data.description}
              onChange={(e) => setData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe this resource..."
              rows={3}
              className="bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
            />
          </div>

          {/* Preview */}
          <div className="p-4 bg-gray-750 border border-gray-600 rounded-lg">
            <Label className="text-gray-200 text-sm">Preview</Label>
            <div className="flex items-start space-x-3 mt-2">
              <div className="text-gray-400 mt-1">
                {getResourceIcon(data.type)}
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-200">
                  {data.title || 'Resource title'}
                </h4>
                {data.description && (
                  <p className="text-sm text-gray-400 mt-1">
                    {data.description}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1 capitalize">
                  {data.type} • Added to "{folderName}"
                </p>
              </div>
            </div>
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
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isPublishing ? 'Adding...' : 'Add Resource'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}