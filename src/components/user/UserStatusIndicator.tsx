import { cn } from '@/lib/utils';
import { useUserStatus, getTraditionalStatusColor, getTraditionalStatusText } from '@/hooks/useUserStatus';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface UserStatusIndicatorProps {
  pubkey: string;
  className?: string;
  showText?: boolean;
}

export function UserStatusIndicator({ pubkey, className, showText = false }: UserStatusIndicatorProps) {
  const { data: status } = useUserStatus(pubkey);

  if (!status) return null;

  const getStatusDisplay = () => {
    // Priority: Custom emoji status > Traditional status > Default
    if (status.emoji) {
      return {
        element: <span className="text-lg leading-none">{status.emoji}</span>,
        text: status.message || 'Custom status'
      };
    }

    if (status.status) {
      return {
        element: <div className={cn('w-3 h-3 rounded-full', getTraditionalStatusColor(status.status))} />,
        text: status.message || getTraditionalStatusText(status.status)
      };
    }

    // Fallback to available status
    return {
      element: <div className={cn('w-3 h-3 rounded-full', 'bg-gray-500')} />,
      text: status.message || 'Available'
    };
  };

  const display = getStatusDisplay();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-pointer">
              {display.element}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{display.text}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {showText && (
        <span className="text-sm text-muted-foreground">
          {display.text}
        </span>
      )}
    </div>
  );
}