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
          This message uses the deprecated NIP-04 encryption method, which is less secure than modern NIP-17.
          New messages will use the more secure NIP-17 protocol automatically.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}