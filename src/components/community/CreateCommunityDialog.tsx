import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Upload, X } from "lucide-react";
import type { Community } from "@/hooks/useCommunities";
import { useUserCommunitiesCache } from "@/hooks/useUserCommunitiesCache";

interface CreateCommunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCommunityDialog({ open, onOpenChange }: CreateCommunityDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    identifier: "",
    image: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useCurrentUser();
  const { mutateAsync: createEvent } = useNostrPublish();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { addCommunityToCache } = useUserCommunitiesCache();

  // Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "Error",
          description: "Image must be smaller than 5MB",
          variant: "destructive",
        });
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast({
          title: "Error",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview("");
    setFormData(prev => ({ ...prev, image: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Optimistic community creation mutation
  const createCommunityMutation = useMutation({
    mutationFn: async () => {
      let imageUrl = formData.image;

      // Upload image if a file is selected
      if (imageFile) {
        try {
          const [[_, url]] = await uploadFile(imageFile);
          imageUrl = url;
        } catch (error) {
          console.error("Failed to upload image:", error);
          throw new Error("Failed to upload community icon");
        }
      }

      const tags = [
        ["d", formData.identifier.toLowerCase().replace(/[^a-z0-9-]/g, "")],
        ["name", formData.name.trim()],
      ];

      if (formData.description.trim()) {
        tags.push(["description", formData.description.trim()]);
      }

      if (imageUrl) {
        tags.push(["image", imageUrl]);
      }

      // Add creator as moderator
      tags.push(["p", user!.pubkey, "", "moderator"]);

      const event = await createEvent({
        kind: 34550,
        content: "",
        tags,
      });

      return event;
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['communities'] });

      // Snapshot the previous value
      const previousCommunities = queryClient.getQueryData<Community[]>(['communities']);

      // Create optimistic community
      const optimisticCommunity: Community = {
        id: `34550:${user!.pubkey}:${formData.identifier.toLowerCase().replace(/[^a-z0-9-]/g, "")}`,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        creator: user!.pubkey,
        moderators: [],
        relays: [],
        event: {
          id: `optimistic-community-${Date.now()}`,
          pubkey: user!.pubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 34550,
          tags: [],
          content: "",
          sig: "",
        },
      };

      // Optimistically update to the new value
      queryClient.setQueryData<Community[]>(['communities'], old => {
        return [...(old || []), optimisticCommunity];
      });

      // Return a context object with the snapshotted value
      return { previousCommunities, optimisticCommunity };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousCommunities) {
        queryClient.setQueryData(['communities'], context.previousCommunities);
      }

      console.error("Failed to create community:", err);
      toast({
        title: "Error",
        description: "Failed to create community. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (event, variables, context) => {
      toast({
        title: "Success",
        description: "Community created successfully!",
      });

      // Add the created community to the user's cache as owner
      if (context?.optimisticCommunity) {
        addCommunityToCache(context.optimisticCommunity, 'owner');
      }

      // Reset form
      setFormData({ name: "", description: "", identifier: "", image: "" });
      setImageFile(null);
      setImagePreview("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onOpenChange(false);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['user-communities'] });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || createCommunityMutation.isPending || isUploading) return;

    if (!formData.name.trim() || !formData.identifier.trim()) {
      toast({
        title: "Error",
        description: "Name and identifier are required",
        variant: "destructive",
      });
      return;
    }

    createCommunityMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a Community</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="community-icon">Community Icon</Label>
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={imagePreview || formData.image} />
                <AvatarFallback className="text-lg">
                  {formData.name ? formData.name.charAt(0).toUpperCase() : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {isUploading ? "Uploading..." : "Upload Icon"}
                </Button>
                {(imagePreview || formData.image) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={removeImage}
                    className="flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Remove
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload a square image (recommended: 256x256px, max 5MB)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Community Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="My Awesome Community"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="identifier">Identifier</Label>
            <Input
              id="identifier"
              value={formData.identifier}
              onChange={(e) => setFormData(prev => ({ ...prev, identifier: e.target.value }))}
              placeholder="my-awesome-community"
              pattern="[a-z0-9-]+"
              title="Only lowercase letters, numbers, and hyphens allowed"
              required
            />
            <p className="text-xs text-muted-foreground">
              Used in URLs and must be unique. Only lowercase letters, numbers, and hyphens.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="A place for awesome discussions..."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createCommunityMutation.isPending || isUploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createCommunityMutation.isPending || isUploading}>
              {createCommunityMutation.isPending ? "Creating..." : isUploading ? "Uploading..." : "Create Community"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}