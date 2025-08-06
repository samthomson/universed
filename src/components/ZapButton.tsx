import { ZapDialog } from '@/components/ZapDialog';
import { Zap } from 'lucide-react';
import type { Event } from 'nostr-tools';

interface ZapButtonProps {
  target: Event;
  className?: string;
}

export function ZapButton({
  target,
  className = ""
}: ZapButtonProps) {
  return (
    <ZapDialog target={target}>
      <button
        className={`p-1 hover:bg-yellow-500/20 rounded transition-colors ${className}`}
        title="Send zap"
      >
        <Zap className="h-4 w-4 text-yellow-500" />
      </button>
    </ZapDialog>
  );
}