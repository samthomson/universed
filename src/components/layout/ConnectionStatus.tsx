import { useState, useMemo } from "react";
import { RefreshCw, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDataManager } from "@/components/DataManagerProvider";
import { cn } from "@/lib/utils";

// Quadrant arcs component - positioned around the globe
function QuadrantArcs({ 
  subscriptions,
  size = 32 // Default size, but can be changed easily
}: { 
  subscriptions: boolean[];
  size?: number;
}) {
  const center = size / 2;
  const outerR = (size / 2) * 0.85; // 85% of radius
  const innerR = (size / 2) * 0.7; // 70% of radius

  const quadrantAngles = [
    { start: 15, end: 75 },
    { start: 105, end: 165 },
    { start: 195, end: 255 },
    { start: 285, end: 345 },
  ];

  const segs = quadrantAngles.map((qa, i) => {
    const start = (qa.start * Math.PI) / 180;
    const end = (qa.end * Math.PI) / 180;
      const x1 = center + outerR * Math.cos(start);
      const y1 = center + outerR * Math.sin(start);
      const x2 = center + outerR * Math.cos(end);
      const y2 = center + outerR * Math.sin(end);
      const x3 = center + innerR * Math.cos(end);
      const y3 = center + innerR * Math.sin(end);
      const x4 = center + innerR * Math.cos(start);
      const y4 = center + innerR * Math.sin(start);
      const d = [
        `M ${x1} ${y1}`,
        `A ${outerR} ${outerR} 0 0 1 ${x2} ${y2}`,
        `L ${x3} ${y3}`,
        `A ${innerR} ${innerR} 0 0 0 ${x4} ${y4}`,
      'Z',
    ].join(' ');
    return { d, connected: !!subscriptions[i], i };
  });

  return (
    <svg 
      viewBox={`0 0 ${size} ${size}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)'
      }}
    >
      {segs.map(seg => (
        <path
          key={seg.i}
          d={seg.d}
          fill={seg.connected ? 'currentColor' : 'transparent'}
          stroke="currentColor"
          strokeWidth="2"
          className={seg.connected ? 'text-emerald-500' : 'text-red-500'}
        />
      ))}
    </svg>
  );
}

export function ConnectionStatus() {
  const { messaging, communities } = useDataManager();
  const [open, setOpen] = useState(false);

  // Memoize subscription states for performance
  const subscriptionStates = useMemo(() => {
    const messagingIsLoading = messaging.isLoading;
    const communitiesIsLoading = communities.isLoading;
    
    // Always show all 4 subscriptions, but mark loading ones as disconnected
    return [
      messagingIsLoading ? false : messaging.subscriptions.nip4,
      messagingIsLoading ? false : messaging.subscriptions.nip17,
      communitiesIsLoading ? false : communities.subscriptions.messages,
      communitiesIsLoading ? false : communities.subscriptions.management,
    ];
  }, [
    messaging.isLoading,
    messaging.subscriptions.nip4,
    messaging.subscriptions.nip17,
    communities.isLoading,
    communities.subscriptions.messages,
    communities.subscriptions.management,
  ]);

  // Calculate connection status - count ALL subscriptions, including loading ones
  const messagingIsLoading = messaging.isLoading;
  const communitiesIsLoading = communities.isLoading;
  
  // Count ALL connections (including loading ones as "not connected")
  const allConnections = [
    messagingIsLoading ? false : messaging.subscriptions.nip4,
    messagingIsLoading ? false : messaging.subscriptions.nip17,
    communitiesIsLoading ? false : communities.subscriptions.messages,
    communitiesIsLoading ? false : communities.subscriptions.management,
  ];
  
  // Total expected connections (always 4)
  const totalExpectedConnections = 4;
  
  // Connected count includes only truly connected subscriptions
  const connectedCount = allConnections.filter(Boolean).length;
  
  // Count how many domains are still loading
  const loadingDomains = [messagingIsLoading, communitiesIsLoading].filter(Boolean).length;
  
  // All connected only if all 4 subscriptions are connected AND no domains are loading
  const allConnected = connectedCount === totalExpectedConnections && loadingDomains === 0;
  const noneConnected = connectedCount === 0 && loadingDomains === 0;
  
  // Determine if we're in a loading/initializing state (any domains are still loading)
  const isInitializing = loadingDomains > 0;

  // Determine icon and color
  const getStatusColor = () => {
    if (isInitializing) return "text-muted-foreground";
    if (allConnected) return "text-emerald-500/40"; // Very subtle green indicating healthy connection
    if (noneConnected) return "text-red-500";
    return "text-orange-500"; // Orange is softer than yellow but still signals attention needed
  };

  // getStatusIcon replaced by CombinedConnectionIcon (globe drawn in SVG)

  const handleReload = () => {
    window.location.reload();
  };

  // This is the key - we're manually controlling the open state
  const handleOpenChange = (newOpen: boolean) => {
    // Only allow changes initiated by the user (clicking the button)
    // Ignore changes triggered by React re-renders
    if (newOpen !== open) {
      setOpen(newOpen);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "w-12 h-12 rounded-2xl relative overflow-visible p-0 bg-accent", // overflow-visible to allow arcs to extend beyond button, p-0 to maximize space
                getStatusColor(),
                // Maintain color on hover with darker background
                isInitializing && "hover:text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-700",
                allConnected && "hover:text-emerald-500/50 hover:bg-slate-200 dark:hover:bg-slate-700",
                noneConnected && "hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-700",
                !isInitializing && !allConnected && !noneConnected && "hover:text-orange-500 hover:bg-slate-200 dark:hover:bg-slate-700"
              )}
            >
              {/* <div className="absolute inset-0 flex items-center justify-center"> */}
                <div className="relative w-full h-full">
                  {/* Center the globe icon absolutely */}
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <Globe className={cn("w-8 h-8", getStatusColor())} />
                  </div>
                  {/* Quadrants positioned independently */}
                  <div className="absolute inset-0">
                    <QuadrantArcs 
                      subscriptions={subscriptionStates}
                      size={40} // You can easily change this number to make the quadrants bigger or smaller
                    />
                  </div>
                </div>
              {/* </div> */}
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
              : `${connectedCount}/${totalExpectedConnections} relay subscriptions active`}
          </p>
        </TooltipContent>
      </Tooltip>

      <PopoverContent 
        side="right" 
        align="start" 
        className="w-80"
        // Prevent auto-focus which can cause issues
        onOpenAutoFocus={(e) => e.preventDefault()}
        // Prevent close on outside interactions
        onInteractOutside={(e) => e.preventDefault()}
      >
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
                  connected={messaging.subscriptions.nip4}
                  isLoading={messagingIsLoading}
                />
                <ConnectionItem
                  label="NIP-17 (Private DMs)"
                  connected={messaging.subscriptions.nip17}
                  isLoading={messagingIsLoading}
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
                  connected={communities.subscriptions.messages}
                  isLoading={communitiesIsLoading}
                />
                <ConnectionItem
                  label="Community Management"
                  connected={communities.subscriptions.management}
                  isLoading={communitiesIsLoading}
                />
              </div>
            </div>
          </div>

          {!allConnected && !isInitializing && (
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
  isLoading,
}: {
  label: string;
  connected: boolean;
  isLoading: boolean;
}) {
  const getStatusColor = () => {
    if (isLoading) return "bg-muted-foreground";
    return connected ? "bg-emerald-500/50" : "bg-red-500"; // Very subtle green indicating healthy connection
  };

  const getStatusText = () => {
    if (isLoading) return "Initializing...";
    return connected ? "Connected" : "Disconnected";
  };

  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/50">
      <span className="text-xs">{label}</span>
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            getStatusColor(),
            isLoading && "animate-pulse"
          )}
        />
        <span className="text-xs text-muted-foreground">
          {getStatusText()}
        </span>
      </div>
    </div>
  );
}