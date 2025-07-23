import { cn } from '@/lib/utils';
import { useUserStatus } from '@/hooks/useUserStatus';

interface UserStatusIndicatorProps {
  pubkey: string;
  className?: string;
  showText?: boolean;
}

export function UserStatusIndicator({ pubkey, className, showText = false }: UserStatusIndicatorProps) {
  const { data: status } = useUserStatus(pubkey);

  if (!status) return null;

  const getStatusColor = () => {
    switch (status.status) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      case 'busy':
        return 'bg-red-500';
      case 'offline':
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    if (status.customMessage) {
      return status.customMessage;
    }
    return status.status.charAt(0).toUpperCase() + status.status.slice(1);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('w-3 h-3 rounded-full', getStatusColor())} />
      {showText && (
        <span className="text-sm text-muted-foreground">
          {getStatusText()}
        </span>
      )}
    </div>
  );
}