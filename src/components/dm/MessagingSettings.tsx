import { MessageSquare } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDirectMessages } from "@/hooks/useDirectMessages";
import { useDefaultProtocolSetting, type DefaultProtocol } from "@/hooks/useDefaultProtocolSetting";

interface MessagingSettingsProps {
  className?: string;
}

export function MessagingSettings({ className }: MessagingSettingsProps) {
  const { isNIP17Enabled, setNIP17Enabled } = useDirectMessages();
  const [defaultProtocol, setDefaultProtocol] = useDefaultProtocolSetting();

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          <h3 className="text-sm font-medium">Messaging</h3>
        </div>

        {/* Protocol Info */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            This app supports both NIP-04 and NIP-17 messaging protocols.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-orange-500 rounded-full" />
              <span>NIP-04</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-purple-500 rounded-full" />
              <span>NIP-17 (optional)</span>
            </div>
          </div>
        </div>

        {/* NIP-17 Toggle */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="nip17-enabled" className="text-sm font-medium">
                Enable NIP-17 Protocol
              </Label>
              <p className="text-xs text-muted-foreground">
                Modern encryption with better privacy (uses more resources)
              </p>
            </div>
            <div className="flex-shrink-0">
              <Switch
                id="nip17-enabled"
                checked={isNIP17Enabled}
                onCheckedChange={(checked) => {
                  console.log('[DEBUG] Switch toggled to:', checked);
                  console.log('[DEBUG] Before toggle - localStorage:', localStorage.getItem('enableNIP17'));
                  setNIP17Enabled(checked);
                  // If disabling NIP-17, force default protocol to NIP-04
                  if (!checked && defaultProtocol === 'nip17') {
                    setDefaultProtocol('nip04');
                  }
                  setTimeout(() => {
                    console.log('[DEBUG] After toggle - localStorage:', localStorage.getItem('enableNIP17'));
                  }, 100);
                }}
              />
            </div>
          </div>
        </div>

        {/* Default Protocol Setting */}
        <div className="space-y-4">
          <div className="space-y-3">
            <Label htmlFor="default-protocol" className="text-sm font-medium">
              Default Messaging Protocol
            </Label>
            <Select 
              value={!isNIP17Enabled ? 'nip04' : defaultProtocol} 
              onValueChange={(value: DefaultProtocol) => setDefaultProtocol(value)}
              disabled={!isNIP17Enabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select default protocol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (Smart Selection)</SelectItem>
                <SelectItem value="nip17">NIP-17 (Modern)</SelectItem>
                <SelectItem value="nip04">NIP-04 (Legacy)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {!isNIP17Enabled && "NIP-17 must be enabled to change the default protocol"}
              {isNIP17Enabled && defaultProtocol === 'auto' && "Automatically selects the best protocol based on conversation history"}
              {isNIP17Enabled && defaultProtocol === 'nip17' && "Always use NIP-17 for new messages"}
              {isNIP17Enabled && defaultProtocol === 'nip04' && "Always use NIP-04 for new messages"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
