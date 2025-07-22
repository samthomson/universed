import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { useQueryClient } from "@tanstack/react-query";

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { user } = useCurrentUser();
  const { mutateAsync: createEvent } = useNostrPublish();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    if (!formData.name.trim() || !formData.identifier.trim()) {
      toast({
        title: "Error",
        description: "Name and identifier are required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const tags = [
        ["d", formData.identifier.toLowerCase().replace(/[^a-z0-9-]/g, "")],
        ["name", formData.name.trim()],
      ];

      if (formData.description.trim()) {
        tags.push(["description", formData.description.trim()]);
      }

      // Add creator as moderator
      tags.push(["p", user.pubkey, "", "moderator"]);

      await createEvent({
        kind: 34550,
        content: "",
        tags,
      });

      toast({
        title: "Success",
        description: "Community created successfully!",
      });

      // Reset form
      setFormData({ name: "", description: "", identifier: "" });
      onOpenChange(false);

      // Refresh communities list
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    } catch (error) {
      console.error("Failed to create community:", error);
      toast({
        title: "Error",
        description: "Failed to create community. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Community"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}