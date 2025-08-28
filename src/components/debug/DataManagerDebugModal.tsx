import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Database, Save, Trash2 } from "lucide-react";
import { useDataManager } from "@/components/DataManagerProvider";

interface DataManagerDebugModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DataManagerDebugModal({ open, onOpenChange }: DataManagerDebugModalProps) {
  const dataManager = useDataManager();
  const debugInfo = dataManager.getDebugInfo();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            DataManager Debug
          </DialogTitle>
          <DialogDescription>
            Current state of the DataManager singleton
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Total Messages */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total Messages:</span>
            <span className="text-sm font-bold text-blue-600">
              {debugInfo.messageCount}
            </span>
          </div>
          
          {/* NIP-4 Section */}
          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-orange-600">NIP-4 Messages:</span>
              <span className="text-sm font-bold text-orange-600">
                {debugInfo.nip4Count}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Last Sync:</span>
              <span className="text-muted-foreground">{debugInfo.nip4Sync}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Subscribed:</span>
              <span className={`text-xs px-2 py-1 rounded ${debugInfo.nip4Subscribed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {debugInfo.nip4Subscribed ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
          
          {/* NIP-17 Section */}
          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-purple-600">NIP-17 Messages:</span>
              <span className="text-sm font-bold text-purple-600">
                {debugInfo.nip17Count}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Last Sync:</span>
              <span className="text-muted-foreground">{debugInfo.nip17Sync}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Enabled:</span>
              <span className={`text-xs px-2 py-1 rounded ${debugInfo.nip17Enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {debugInfo.nip17Enabled ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Subscribed:</span>
              <span className={`text-xs px-2 py-1 rounded ${debugInfo.nip17Subscribed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {debugInfo.nip17Subscribed ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
          
          {/* Write to Store Button */}
          <div className="border-t pt-3">
            <Button 
              onClick={dataManager.writeAllMessagesToStore}
              className="w-full"
              variant="outline"
              size="sm"
            >
              <Save className="w-4 h-4 mr-2" />
              Write All Messages to IndexedDB
            </Button>
          </div>
          
          {/* Clear IndexedDB Button */}
          <div className="pt-2">
            <Button 
              onClick={dataManager.clearIndexedDB}
              className="w-full"
              variant="destructive"
              size="sm"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear IndexedDB & Reset State
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
