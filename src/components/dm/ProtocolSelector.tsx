import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MESSAGE_PROTOCOL, PROTOCOL_CONFIG, type MessageProtocol, useDirectMessages } from "@/hooks/useDirectMessages";

interface ProtocolSelectorProps {
  selectedProtocol: MessageProtocol;
  onProtocolChange: (protocol: MessageProtocol) => void;
  className?: string;
}

export function ProtocolSelector({ 
  selectedProtocol, 
  onProtocolChange, 
  className = "" 
}: ProtocolSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { isNIP17Enabled } = useDirectMessages();
  
  console.log('[ProtocolSelector] isNIP17Enabled:', isNIP17Enabled, 'selectedProtocol:', selectedProtocol);
  const selectedConfig = PROTOCOL_CONFIG[selectedProtocol];

  // If NIP-17 is disabled and currently selected, show NIP-04 instead
  const effectiveProtocol = !isNIP17Enabled && selectedProtocol === MESSAGE_PROTOCOL.NIP17 
    ? MESSAGE_PROTOCOL.NIP04 
    : selectedProtocol;
  const effectiveConfig = PROTOCOL_CONFIG[effectiveProtocol];

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 px-2 text-xs ${effectiveConfig.textColor} hover:bg-gray-100 dark:hover:bg-gray-800 ${className}`}
          disabled={!isNIP17Enabled} // Disable dropdown when NIP-17 is off (only NIP-04 available)
        >
          <span className="font-medium">{effectiveConfig.label}</span>
          {isNIP17Enabled && <ChevronDown className="h-3 w-3 ml-1" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-24">
        <DropdownMenuItem
          onClick={() => {
            onProtocolChange(MESSAGE_PROTOCOL.NIP04);
            setIsOpen(false);
          }}
          className={`text-xs ${selectedProtocol === MESSAGE_PROTOCOL.NIP04 ? 'bg-orange-50 dark:bg-orange-900/20' : ''}`}
        >
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 ${PROTOCOL_CONFIG[MESSAGE_PROTOCOL.NIP04].color} rounded-full`} />
            <span>{PROTOCOL_CONFIG[MESSAGE_PROTOCOL.NIP04].label}</span>
          </div>
        </DropdownMenuItem>
        {isNIP17Enabled && (
          <DropdownMenuItem
            onClick={() => {
              onProtocolChange(MESSAGE_PROTOCOL.NIP17);
              setIsOpen(false);
            }}
            className={`text-xs ${selectedProtocol === MESSAGE_PROTOCOL.NIP17 ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 ${PROTOCOL_CONFIG[MESSAGE_PROTOCOL.NIP17].color} rounded-full`} />
              <span>{PROTOCOL_CONFIG[MESSAGE_PROTOCOL.NIP17].label}</span>
            </div>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
