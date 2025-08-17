import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MESSAGE_PROTOCOL, PROTOCOL_CONFIG, type MessageProtocol } from "@/hooks/useDirectMessages";

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
  const selectedConfig = PROTOCOL_CONFIG[selectedProtocol];

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 px-2 text-xs ${selectedConfig.textColor} hover:bg-gray-100 dark:hover:bg-gray-800 ${className}`}
        >
          <span className="font-medium">{selectedConfig.label}</span>
          <ChevronDown className="h-3 w-3 ml-1" />
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
