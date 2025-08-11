import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CreateCommunityDialog } from "./CreateCommunityDialog";
import { CommunityDiscovery } from "@/components/discovery/CommunityDiscovery";

interface CommunitySelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommunitySelect?: (communityId: string) => void;
}

export function CommunitySelectionDialog({
  open,
  onOpenChange,
  onCommunitySelect
}: CommunitySelectionDialogProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleCreateCommunity = () => {
    setShowCreateDialog(true);
  };

  const handleCommunitySelect = (communityId: string) => {
    onCommunitySelect?.(communityId);
    onOpenChange(false);
  };

  const handleCreateDialogClose = (open: boolean) => {
    setShowCreateDialog(open);
  };

  const handleCommunityCreated = (communityId: string) => {
    // When a community is created, close this dialog entirely
    onOpenChange(false);
    // Also select the newly created community so the user can see it
    onCommunitySelect?.(communityId);
  };

  // If create dialog is open, show it instead
  if (showCreateDialog) {
    return (
      <CreateCommunityDialog
        open={showCreateDialog}
        onOpenChange={handleCreateDialogClose}
        onCommunityCreated={handleCommunityCreated}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] bg-slate-900/95 backdrop-blur-sm border border-slate-700/50">
        <div className="relative z-10">
          <DialogHeader className="pb-6">
            <div className="mt-6 space-y-6">
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-white text-left mb-4">
                  DISCOVER YOUR SPACE
                  </h1>
                  <p className="text-slate-300 leading-relaxed text-lg">
                    Explore existing communities to join and connect with like-minded people.
                    Find vibrant discussions, share interests, and become part of growing communities
                    on the decentralized Nostr network.
                  </p>
                </div>

                <div className="lg:w-128">
                  <div className="relative p-6 rounded-2xl bg-slate-800/40 backdrop-blur-sm border border-slate-700/50">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-semibold text-white mb-2">
                          Can't find what you're looking for?
                        </h4>
                        <p className="text-slate-300 text-sm leading-relaxed">
                          Create your own community and build the space you've always wanted.
                        </p>
                      </div>
                      <Button
                        onClick={handleCreateCommunity}
                        className="w-full rounded-full py-6 text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transform transition-all duration-200 hover:scale-105 shadow-lg shadow-purple-500/25"
                      >
                        <Plus className="w-5 h-5 mr-2" />
                        Create Space
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto pr-2">
            <CommunityDiscovery onCommunitySelect={handleCommunitySelect} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}