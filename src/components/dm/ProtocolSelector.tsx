import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MESSAGE_PROTOCOL, PROTOCOL_CONFIG, type MessageProtocol } from "@/lib/dmConstants";
import { useUserSettings } from "@/hooks/useUserSettings";
import { ProtocolIndicator } from "./ProtocolIndicator";

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
  const { settings } = useUserSettings();
  const isNIP17Enabled = settings.enableNIP17;

  // If NIP-17 is disabled and currently selected, show NIP-04 instead
  const effectiveProtocol = !isNIP17Enabled && selectedProtocol === MESSAGE_PROTOCOL.NIP17
    ? MESSAGE_PROTOCOL.NIP04
    : selectedProtocol;
  const effectiveConfig = PROTOCOL_CONFIG[effectiveProtocol];

  // If only one protocol is available, show just the indicator without dropdown
  if (!isNIP17Enabled) {
    return (
      <div className={`h-6 px-2 text-xs flex items-center transition-all duration-200 ease-in-out ${effectiveConfig.textColor} ${className}`}>
        <span className="font-medium">{effectiveConfig.label}</span>
      </div>
    );
  }

  return (
    <div className="transition-all duration-200 ease-in-out">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 px-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 ${effectiveConfig.textColor} ${className}`}
          >
            <span className="font-medium">{effectiveConfig.label}</span>
            <ChevronDown className="h-3 w-3 ml-1 transition-transform duration-200" />
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
              <ProtocolIndicator protocol={MESSAGE_PROTOCOL.NIP04} />
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
              <ProtocolIndicator protocol={MESSAGE_PROTOCOL.NIP17} />
              <span>{PROTOCOL_CONFIG[MESSAGE_PROTOCOL.NIP17].label}</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
