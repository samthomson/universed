import { MessageSquare } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useDirectMessages } from "@/hooks/useDirectMessages";

interface MessagingSettingsProps {
  className?: string;
}

export function MessagingSettings({ className }: MessagingSettingsProps) {
  const { isNIP17Enabled, setNIP17Enabled } = useDirectMessages();

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          <h3 className="text-sm font-medium">Messaging</h3>
        </div>

        {/* NIP-17 Toggle */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="nip17-enabled" className="text-sm font-medium">
                Enable NIP-17 Protocol
              </Label>
              <p className="text-xs text-muted-foreground">
                Modern encryption with better privacy (uses more resources)
              </p>
            </div>
            <Switch
              id="nip17-enabled"
              checked={isNIP17Enabled}
              onCheckedChange={setNIP17Enabled}
            />
          </div>

          {/* Protocol Info */}
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>This app supports both NIP-04 and NIP-17 messaging protocols.</p>
            <div className="flex items-center gap-4">
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
        </div>
      </div>
    </div>
  );
}
