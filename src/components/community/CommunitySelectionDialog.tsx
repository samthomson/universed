import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search } from "lucide-react";
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
  const [view, setView] = useState<'selection' | 'create' | 'discover'>('selection');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleCreateCommunity = () => {
    setView('create');
    setShowCreateDialog(true);
  };

  const handleDiscoverCommunities = () => {
    setView('discover');
  };

  const handleBack = () => {
    setView('selection');
    setShowCreateDialog(false);
  };

  const handleCommunitySelect = (communityId: string) => {
    onCommunitySelect?.(communityId);
    onOpenChange(false);
  };

  const handleCreateDialogClose = (open: boolean) => {
    setShowCreateDialog(open);
    if (!open) {
      setView('selection');
    }
  };

  // If we're in create view, show the create dialog
  if (view === 'create') {
    return (
      <CreateCommunityDialog
        open={showCreateDialog}
        onOpenChange={handleCreateDialogClose}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${view === 'discover' ? "max-w-6xl max-h-[90vh]" : "sm:max-w-md"} bg-gray-800 border-gray-700`}>
        <DialogHeader>
          <DialogTitle className="text-white text-xl">
            {view === 'discover' ? 'Discover Communities' : 'Add a Community'}
          </DialogTitle>
        </DialogHeader>

        {view === 'selection' ? (
          <div className="space-y-3">
            <Card
              className="cursor-pointer bg-gray-800/40 border-gray-700 hover:bg-gray-700/60 transition-all duration-200 group"
              onClick={handleCreateCommunity}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-green-500 rounded-2xl hover:rounded-xl transition-all duration-200 flex items-center justify-center group-hover:bg-green-400">
                    <Plus className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg text-white group-hover:text-green-400 transition-colors">
                      Create New Community
                    </CardTitle>
                    <CardDescription className="text-gray-400 text-sm mt-1">
                      Start your own community and invite others to join
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card
              className="cursor-pointer bg-gray-800/40 border-gray-700 hover:bg-gray-700/60 transition-all duration-200 group"
              onClick={handleDiscoverCommunities}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-indigo-500 rounded-2xl hover:rounded-xl transition-all duration-200 flex items-center justify-center group-hover:bg-indigo-400">
                    <Search className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg text-white group-hover:text-indigo-400 transition-colors">
                      Discover Communities
                    </CardTitle>
                    <CardDescription className="text-gray-400 text-sm mt-1">
                      Browse and join existing communities
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <div className="flex justify-end pt-2">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-gray-400 hover:text-white hover:bg-gray-700"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={handleBack}
                className="text-gray-400 hover:text-white hover:bg-gray-700"
              >
                ← Back
              </Button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto pr-2">
              <CommunityDiscovery onCommunitySelect={handleCommunitySelect} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}