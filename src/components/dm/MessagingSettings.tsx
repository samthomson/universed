import { MessageSquare, Shield } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
          <h3 className="text-sm font-medium">Message Protocol</h3>
        </div>

        {/* NIP-17 Toggle */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="nip17-enabled" className="text-sm font-medium">
                Enable NIP-17 Messages
              </Label>
              <p className="text-xs text-muted-foreground">
                Use modern NIP-44/NIP-17 encryption for enhanced security and features
              </p>
            </div>
            <Switch
              id="nip17-enabled"
              checked={isNIP17Enabled}
              onCheckedChange={setNIP17Enabled}
            />
          </div>

          {/* Protocol Info */}
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full" />
              <span>NIP-04: Legacy encrypted messages</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full" />
              <span>NIP-17: Modern encrypted messages with enhanced privacy</span>
            </div>
          </div>

          {/* Security Note */}
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
            <Shield className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Security Note</p>
              <p>
                NIP-17 provides better metadata protection and forward secrecy. 
                Both protocols remain secure for private messaging.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
