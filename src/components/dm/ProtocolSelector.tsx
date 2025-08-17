import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MESSAGE_PROTOCOL, type MessageProtocol } from "@/hooks/useDirectMessages";

interface ProtocolSelectorProps {
  selectedProtocol: MessageProtocol;
  onProtocolChange: (protocol: MessageProtocol) => void;
  className?: string;
}

const PROTOCOL_LABELS = {
  [MESSAGE_PROTOCOL.NIP04]: "NIP-04",
  [MESSAGE_PROTOCOL.NIP17]: "NIP-17",
  [MESSAGE_PROTOCOL.UNKNOWN]: "Unknown",
} as const;

const PROTOCOL_COLORS = {
  [MESSAGE_PROTOCOL.NIP04]: "text-orange-600 dark:text-orange-400",
  [MESSAGE_PROTOCOL.NIP17]: "text-purple-600 dark:text-purple-400", 
  [MESSAGE_PROTOCOL.UNKNOWN]: "text-gray-600 dark:text-gray-400",
} as const;

export function ProtocolSelector({ 
  selectedProtocol, 
  onProtocolChange, 
  className = "" 
}: ProtocolSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 px-2 text-xs ${PROTOCOL_COLORS[selectedProtocol]} hover:bg-gray-100 dark:hover:bg-gray-800 ${className}`}
        >
          <span className="font-medium">{PROTOCOL_LABELS[selectedProtocol]}</span>
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
            <div className="w-2 h-2 bg-orange-500 rounded-full" />
            <span>NIP-04</span>
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
            <div className="w-2 h-2 bg-purple-500 rounded-full" />
            <span>NIP-17</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
