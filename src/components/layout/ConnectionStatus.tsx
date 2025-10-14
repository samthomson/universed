import { useState } from "react";
import { Globe, Globe2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDataManager } from "@/components/DataManagerProvider";
import { cn } from "@/lib/utils";

export function ConnectionStatus() {
  const { messaging, communities } = useDataManager();
  const [open, setOpen] = useState(false);

  // Calculate connection status
  const messagingConnections = {
    nip4: messaging.subscriptions.nip4,
    nip17: messaging.subscriptions.nip17,
  };

  const communityConnections = {
    messages: communities.subscriptions.messages,
    management: communities.subscriptions.management,
  };

  const allConnections = [
    ...Object.values(messagingConnections),
    ...Object.values(communityConnections),
  ];

  const connectedCount = allConnections.filter(Boolean).length;
  const totalCount = allConnections.length;
  const allConnected = connectedCount === totalCount;
  const noneConnected = connectedCount === 0;
  
  // Determine if we're in a loading/initializing state
  const isInitializing = (messaging.isLoading || communities.isLoading) && noneConnected;

  // Determine icon and color
  const getStatusColor = () => {
    if (isInitializing) return "text-muted-foreground";
    if (allConnected) return "text-green-500";
    if (noneConnected) return "text-red-500";
    return "text-yellow-500";
  };

  const getStatusIcon = () => {
    if (isInitializing) return <Globe className="h-4 w-4 animate-pulse" />;
    if (noneConnected) return <Globe className="h-4 w-4 opacity-50" />;
    if (allConnected) return <Globe2 className="h-4 w-4" />;
    return <Globe2 className="h-4 w-4" />;
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "w-12 h-12 rounded-2xl relative",
                getStatusColor(),
                !allConnected && "hover:bg-yellow-500/10"
              )}
            >
              {getStatusIcon()}
              {!allConnected && !isInitializing && (
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>
            {isInitializing
              ? "Initializing relay connections..."
              : allConnected
              ? "All relay subscriptions active"
              : noneConnected
              ? "No relay connections"
              : `${connectedCount}/${totalCount} relay subscriptions active`}
          </p>
        </TooltipContent>
      </Tooltip>

      <PopoverContent side="right" align="start" className="w-80">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Relay Connection Status</h4>
            <p className="text-xs text-muted-foreground">
              {isInitializing
                ? "Initializing relay subscriptions..."
                : allConnected
                ? "All subscriptions are connected"
                : "Some subscriptions are disconnected"}
            </p>
          </div>

          <div className="space-y-3">
            {/* Messages Section */}
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-2">
                Messages
              </h5>
              <div className="space-y-1">
                <ConnectionItem
                  label="NIP-4 (Legacy DMs)"
                  connected={messagingConnections.nip4}
                />
                <ConnectionItem
                  label="NIP-17 (Private DMs)"
                  connected={messagingConnections.nip17}
                />
              </div>
            </div>

            {/* Communities Section */}
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-2">
                Communities
              </h5>
              <div className="space-y-1">
                <ConnectionItem
                  label="Channel Messages"
                  connected={communityConnections.messages}
                />
                <ConnectionItem
                  label="Community Management"
                  connected={communityConnections.management}
                />
              </div>
            </div>
          </div>

          {!allConnected && (
            <Button
              onClick={handleReload}
              className="w-full"
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-3 w-3 mr-2" />
              Reload App
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ConnectionItem({
  label,
  connected,
}: {
  label: string;
  connected: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/50">
      <span className="text-xs">{label}</span>
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            connected ? "bg-green-500" : "bg-red-500"
          )}
        />
        <span className="text-xs text-muted-foreground">
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>
    </div>
  );
}

