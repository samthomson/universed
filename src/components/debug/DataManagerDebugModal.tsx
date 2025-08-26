import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Database } from "lucide-react";
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
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Messages:</span>
            <span className="text-sm font-bold text-blue-600">
              {debugInfo.messageCount}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">NIP-4 Last Sync:</span>
            <span className="text-sm font-bold text-orange-600">
              {debugInfo.nip4Sync}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">NIP-17 Last Sync:</span>
            <span className="text-sm font-bold text-purple-600">
              {debugInfo.nip17Sync}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
