
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useDefaultProtocolSetting, type DefaultProtocol } from "@/hooks/useDefaultProtocolSetting";

import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

interface MessagingSettingsProps {
  className?: string;
}

export function MessagingSettings({ className }: MessagingSettingsProps) {
  const { settings, updateSetting } = useUserSettings();
  const [defaultProtocol, setDefaultProtocol] = useDefaultProtocolSetting();

  return (
    <div className={className}>
      <div className="space-y-4">
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
                checked={settings.enableNIP17}
                onCheckedChange={(checked) => {
                  updateSetting('enableNIP17', checked);
                  // If disabling NIP-17, force default protocol to NIP-04
                  if (!checked && defaultProtocol === 'nip17') {
                    setDefaultProtocol('nip04');
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Default Protocol Setting - Only show when NIP-17 is enabled */}
        <div className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          {
            "max-h-40 opacity-100": settings.enableNIP17,
            "max-h-0 opacity-0": !settings.enableNIP17,
          }
        )}>
          <div className="space-y-4">
            <div className="space-y-3">
              <Label htmlFor="default-protocol" className="text-sm font-medium">
                Default Messaging Protocol
              </Label>
              <Select
                value={defaultProtocol}
                onValueChange={(value: DefaultProtocol) => setDefaultProtocol(value)}
                disabled={!settings.enableNIP17}
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
                {defaultProtocol === 'auto' && "Automatically selects the best protocol based on conversation history"}
                {defaultProtocol === 'nip17' && "Always use NIP-17 for new messages"}
                {defaultProtocol === 'nip04' && "Always use NIP-04 for new messages"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
