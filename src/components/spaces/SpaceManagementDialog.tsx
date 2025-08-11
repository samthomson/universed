import { useState } from 'react';
import {
  Settings,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  GripVertical,
  ShoppingBag,
  BookOpen,
  Box,
  Palette,
  Globe,
  Users,
  MessageSquare,
  Calendar,
  Music,
  Camera,
  Code,
  Gamepad2,
  Heart,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAllSpaces, useUpdateSpace, useDeleteSpace, type Space } from '@/hooks/useSpaces';
import { useToast } from '@/hooks/useToast';

interface SpaceManagementDialogProps {
  communityId: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const SPACE_ICONS = [
  { value: 'ShoppingBag', label: 'Shopping Bag', icon: ShoppingBag },
  { value: 'BookOpen', label: 'Book', icon: BookOpen },
  { value: 'Box', label: 'Box', icon: Box },
  { value: 'Palette', label: 'Palette', icon: Palette },
  { value: 'Globe', label: 'Globe', icon: Globe },
  { value: 'Users', label: 'Users', icon: Users },
  { value: 'MessageSquare', label: 'Messages', icon: MessageSquare },
  { value: 'Calendar', label: 'Calendar', icon: Calendar },
  { value: 'Music', label: 'Music', icon: Music },
  { value: 'Camera', label: 'Camera', icon: Camera },
  { value: 'Code', label: 'Code', icon: Code },
  { value: 'Gamepad2', label: 'Gaming', icon: Gamepad2 },
  { value: 'Heart', label: 'Heart', icon: Heart },
  { value: 'Zap', label: 'Lightning', icon: Zap },
];

export function SpaceManagementDialog({
  communityId,
  trigger,
  open,
  onOpenChange
}: SpaceManagementDialogProps) {
  const { data: spaces, refetch } = useAllSpaces(communityId);
  const { mutateAsync: updateSpace } = useUpdateSpace(communityId);
  const { mutateAsync: deleteSpace } = useDeleteSpace(communityId);
  const { toast } = useToast();
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleToggleSpace = async (space: Space) => {
    try {
      await updateSpace({
        spaceId: space.id,
        name: space.name,
        description: space.description,
        type: space.type,
        icon: space.icon,
        enabled: !space.enabled,
        position: space.position,
      });

      toast({
        title: space.enabled ? 'Space disabled' : 'Space enabled',
        description: `${space.name} has been ${space.enabled ? 'disabled' : 'enabled'}.`,
      });

      refetch();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update space. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteSpace = async (space: Space) => {
    if (!space.event?.id) return;

    try {
      await deleteSpace({
        spaceEventId: space.event.id,
        spaceName: space.name,
      });

      toast({
        title: 'Space deleted',
        description: `${space.name} has been deleted.`,
      });

      refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete space.',
        variant: 'destructive',
      });
    }
  };

  const getIconComponent = (iconName: string) => {
    const iconData = SPACE_ICONS.find(icon => icon.value === iconName);
    return iconData ? iconData.icon : Box;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-[95vw] sm:max-w-2xl lg:max-w-4xl max-h-[80vh] max-h-[80dvh] overflow-y-auto bg-gray-800 border-gray-600 p-0">
        <div className="flex flex-col h-full">
          <DialogHeader className="p-6 pb-4 flex-shrink-0">
            <DialogTitle className="flex items-center space-x-2 text-gray-100">
              <Settings className="w-5 h-5" />
              <span>Manage Spaces</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4 sm:space-y-6">
            {/* Create New Space */}
            <Card className="bg-gray-750 border-gray-600">
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg text-gray-100">Create New Space</CardTitle>
              </CardHeader>
              <CardContent>
                {isCreating ? (
                  <CreateSpaceForm
                    communityId={communityId}
                    onCancel={() => setIsCreating(false)}
                    onSuccess={() => {
                      setIsCreating(false);
                      refetch();
                    }}
                  />
                ) : (
                  <Button onClick={() => setIsCreating(true)} className="w-full bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Custom Space
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Existing Spaces */}
            <Card className="bg-gray-750 border-gray-600">
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg text-gray-100">Existing Spaces</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                {spaces?.map((space) => (
                  <div key={space.id}>
                    {editingSpace?.id === space.id ? (
                      <EditSpaceForm
                        space={space}
                        communityId={communityId}
                        onCancel={() => setEditingSpace(null)}
                        onSuccess={() => {
                          setEditingSpace(null);
                          refetch();
                        }}
                      />
                    ) : (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border border-gray-600 rounded-lg bg-gray-700 gap-3 sm:gap-0">
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <div className="flex items-center space-x-2 shrink-0">
                            <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                            {(() => {
                              const IconComponent = getIconComponent(space.icon);
                              return <IconComponent className="w-5 h-5 text-gray-300" />;
                            })()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 gap-1 sm:gap-0">
                              <h3 className="font-medium text-gray-100 truncate">{space.name}</h3>
                              <div className="flex items-center space-x-1 sm:space-x-2">
                                <Badge variant={space.type === 'custom' ? 'default' : 'secondary'} className="text-xs">
                                  {space.type}
                                </Badge>
                                {!space.enabled && (
                                  <Badge variant="outline" className="text-xs">Disabled</Badge>
                                )}
                              </div>
                            </div>
                            {space.description && (
                              <p className="text-xs sm:text-sm text-gray-400 truncate">
                                {space.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleSpace(space)}
                          >
                            {space.enabled ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingSpace(space)}
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                          {space.type === 'custom' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSpace(space)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateSpaceForm({
  communityId,
  onCancel,
  onSuccess
}: {
  communityId: string;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('Box');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { mutateAsync: updateSpace } = useUpdateSpace(communityId);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await updateSpace({
        spaceId: name.toLowerCase().replace(/\s+/g, '-'),
        name: name.trim(),
        description: description.trim(),
        type: 'custom',
        icon,
        enabled: true,
        position: 999, // Put new spaces at the end
      });

      toast({
        title: 'Space created',
        description: `${name} has been created successfully.`,
      });

      onSuccess();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to create space. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Space Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter space name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="icon">Icon</Label>
          <Select value={icon} onValueChange={setIcon}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPACE_ICONS.map((iconData) => {
                const IconComponent = iconData.icon;
                return (
                  <SelectItem key={iconData.value} value={iconData.value}>
                    <div className="flex items-center space-x-2">
                      <IconComponent className="w-4 h-4" />
                      <span>{iconData.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what this space is for"
          rows={3}
        />
      </div>
      <div className="flex flex-col sm:flex-row justify-end gap-2 sm:space-x-2">
        <Button type="button" variant="outline" onClick={onCancel} className="order-2 sm:order-1">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !name.trim()} className="order-1 sm:order-2">
          Create Space
        </Button>
      </div>
    </form>
  );
}

function EditSpaceForm({
  space,
  communityId,
  onCancel,
  onSuccess
}: {
  space: Space;
  communityId: string;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(space.name);
  const [description, setDescription] = useState(space.description || '');
  const [icon, setIcon] = useState(space.icon);
  const [enabled, setEnabled] = useState(space.enabled);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { mutateAsync: updateSpace } = useUpdateSpace(communityId);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await updateSpace({
        spaceId: space.id,
        name: name.trim(),
        description: description.trim(),
        type: space.type,
        icon,
        enabled,
        position: space.position,
      });

      toast({
        title: 'Space updated',
        description: `${name} has been updated successfully.`,
      });

      onSuccess();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update space. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-3 sm:p-4 border rounded-lg bg-muted/50">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-name">Space Name</Label>
          <Input
            id="edit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter space name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-icon">Icon</Label>
          <Select value={icon} onValueChange={setIcon}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPACE_ICONS.map((iconData) => {
                const IconComponent = iconData.icon;
                return (
                  <SelectItem key={iconData.value} value={iconData.value}>
                    <div className="flex items-center space-x-2">
                      <IconComponent className="w-4 h-4" />
                      <span>{iconData.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-description">Description</Label>
        <Textarea
          id="edit-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what this space is for"
          rows={3}
        />
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          id="edit-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
        <Label htmlFor="edit-enabled">Enable this space</Label>
      </div>
      <div className="flex flex-col sm:flex-row justify-end gap-2 sm:space-x-2">
        <Button type="button" variant="outline" onClick={onCancel} className="order-2 sm:order-1">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !name.trim()} className="order-1 sm:order-2">
          Save Changes
        </Button>
      </div>
    </form>
  );
}