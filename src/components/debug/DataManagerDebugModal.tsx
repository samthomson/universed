import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Database } from "lucide-react";
import { useDataManager } from "@/hooks/useDataManager";

interface DataManagerDebugModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DataManagerDebugModal({ open, onOpenChange }: DataManagerDebugModalProps) {
  const dataManager = useDataManager();
  const [_refreshKey, setRefreshKey] = useState(0);

  const debugInfo = dataManager.getDebugInfo();

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

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
            <span className="text-sm font-medium">Status:</span>
            <Badge variant="default">
              {debugInfo.status as string}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Message:</span>
            <span className="text-sm text-green-600">
              {debugInfo.message as string}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-muted/50 rounded">
              <div className="text-lg font-bold text-blue-600">
                {debugInfo.activeSubscriptions as number}
              </div>
              <div className="text-xs text-muted-foreground">
                Subscriptions
              </div>
            </div>
            <div className="p-2 bg-muted/50 rounded">
              <div className="text-lg font-bold text-green-600">
                {debugInfo.cachedMessages as number}
              </div>
              <div className="text-xs text-muted-foreground">
                Messages
              </div>
            </div>
            <div className="p-2 bg-muted/50 rounded">
              <div className="text-lg font-bold text-purple-600">
                {debugInfo.processedNIP17Events as number}
              </div>
              <div className="text-xs text-muted-foreground">
                NIP17 Events
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-muted-foreground">
              {debugInfo.timestamp as string}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
