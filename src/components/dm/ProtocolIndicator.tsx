import { MESSAGE_PROTOCOL, PROTOCOL_CONFIG } from '@/hooks/useDirectMessages';

interface ProtocolIndicatorProps {
  protocol: typeof MESSAGE_PROTOCOL.NIP04 | typeof MESSAGE_PROTOCOL.NIP17;
  className?: string;
}

export function ProtocolIndicator({ protocol, className = '' }: ProtocolIndicatorProps) {
  const config = PROTOCOL_CONFIG[protocol];
  
  return (
    <div 
      className={`w-2 h-2 ${config.color} rounded-full border border-border ${className}`}
      title={config.title}
    />
  );
}
