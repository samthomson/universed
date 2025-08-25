import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Database, Activity } from "lucide-react";
import { useDataManager } from "@/hooks/useDataManager";

interface DataManagerDebugModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DataManagerDebugModal({ open, onOpenChange }: DataManagerDebugModalProps) {
  const dataManager = useDataManager();
  const [refreshKey, setRefreshKey] = useState(0);

  const debugInfo = dataManager.getDebugInfo();
  const foobarData = dataManager.getFoobarData();

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            DataManager Debug Info
          </DialogTitle>
          <DialogDescription>
            Internal state and debug information from the DataManager singleton
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Status
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  className="h-8"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Refresh
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Instance Status:</span>
                <Badge variant="default">
                  {debugInfo.status as string}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Last Updated:</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {debugInfo.timestamp as string}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Foobar Message:</span>
                <span className="text-sm text-green-600">
                  {debugInfo.foobar as string}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Stub Data Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Stub Data</CardTitle>
              <CardDescription>
                Placeholder data that will be replaced with real metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {(debugInfo.stubData as any)?.activeSubscriptions || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Active Subscriptions
                  </div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {(debugInfo.stubData as any)?.cachedMessages || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Cached Messages
                  </div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {(debugInfo.stubData as any)?.processedNIP17Events || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    NIP17 Events
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Foobar Data List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Foobar Data</CardTitle>
              <CardDescription>
                Test data from DataManager methods
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {foobarData.map((item, index) => (
                  <div key={`${refreshKey}-${index}`} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                    <Badge variant="outline" className="text-xs">
                      {index + 1}
                    </Badge>
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Raw Debug JSON */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Raw Debug Data</CardTitle>
              <CardDescription>
                Complete debug information as JSON
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
