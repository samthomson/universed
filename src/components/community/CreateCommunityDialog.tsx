import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import type { Community } from "@/hooks/useCommunities";

interface CreateCommunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCommunityDialog({ open, onOpenChange }: CreateCommunityDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    identifier: "",
  });

  const { user } = useCurrentUser();
  const { mutateAsync: createEvent } = useNostrPublish();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Optimistic community creation mutation
  const createCommunityMutation = useMutation({
    mutationFn: async () => {
      const tags = [
        ["d", formData.identifier.toLowerCase().replace(/[^a-z0-9-]/g, "")],
        ["name", formData.name.trim()],
      ];

      if (formData.description.trim()) {
        tags.push(["description", formData.description.trim()]);
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
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Community created successfully!",
      });

      // Reset form
      setFormData({ name: "", description: "", identifier: "" });
      onOpenChange(false);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || createCommunityMutation.isPending) return;

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
              disabled={createCommunityMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createCommunityMutation.isPending}>
              {createCommunityMutation.isPending ? "Creating..." : "Create Community"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}