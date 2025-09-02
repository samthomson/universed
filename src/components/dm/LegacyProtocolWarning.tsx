import { AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface LegacyProtocolWarningProps {
  className?: string;
}

export function LegacyProtocolWarning({ className = '' }: LegacyProtocolWarningProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`inline-flex text-amber-600 dark:text-amber-400 ${className}`}>
          <AlertTriangle className="h-3 w-3" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs z-50" align="center" collisionPadding={8}>
        <p className="text-sm">
          NIP-04 encryption, legacy support only
        </p>
      </TooltipContent>
    </Tooltip>
  );
}