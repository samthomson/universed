import {  Wifi, Activity, Wallet, Sun, Moon, Monitor, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RelaySelector } from "@/components/RelaySelector";
import { WalletConfigDialog } from "@/components/WalletConfigDialog";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";

import { useTheme } from "@/hooks/useTheme";
import { useUserSettings } from "@/hooks/useUserSettings";
import { genUserName } from "@/lib/genUserName";
import { MessagingSettings } from "@/components/dm/MessagingSettings";

interface UserSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserSettingsDialog({ open, onOpenChange }: UserSettingsDialogProps) {
  const { user } = useCurrentUser();
  const { theme, setTheme } = useTheme();
  const { settings, updateSetting } = useUserSettings();
  const author = useAuthor(user?.pubkey || '');
  const metadata = author.data?.metadata;

  if (!user) return null;

  const displayName = metadata?.name || genUserName(user.pubkey);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>User Settings</DialogTitle>
          <DialogDescription>
            Manage your account settings and preferences for {displayName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Theme Settings */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4" />
              <h3 className="text-sm font-medium">Theme</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Choose your preferred theme for the application.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("light")}
                className="flex items-center gap-2"
              >
                <Sun className="h-4 w-4" />
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("dark")}
                className="flex items-center gap-2"
              >
                <Moon className="h-4 w-4" />
                Dark
              </Button>
              <Button
                variant={theme === "system" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("system")}
                className="flex items-center gap-2"
              >
                <Monitor className="h-4 w-4" />
                System
              </Button>
            </div>
          </div>

          <Separator />

          {/* Relay Settings */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              <h3 className="text-sm font-medium">Relay Connection</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Choose which relay to connect to for sending and receiving messages.
            </p>
            <RelaySelector className="w-full" />
          </div>

          <Separator />

          {/* Wallet Configuration */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              <h3 className="text-sm font-medium">Wallet Configuration</h3>
            </div>
            <WalletConfigDialog />
            <p className="text-xs text-muted-foreground">
              Configure your Lightning wallet connections for Nostr Wallet Connect (NWC) payments.
            </p>
          </div>

          <Separator />

          {/* Community Settings */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <h3 className="text-sm font-medium">Communities</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="show-pending">Show Pending Communities</Label>
                  <p className="text-xs text-muted-foreground">
                    Display communities you've requested to join in the sidebar
                  </p>
                </div>
                <Switch
                  id="show-pending"
                  checked={settings.showPendingCommunities}
                  onCheckedChange={(checked) => updateSetting('showPendingCommunities', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="spam-filtering">Enable Spam Filtering</Label>
                  <p className="text-xs text-muted-foreground">
                    Filter out communities with suspicious names or content
                  </p>
                </div>
                <Switch
                  id="spam-filtering"
                  checked={settings.enableSpamFiltering}
                  onCheckedChange={(checked) => updateSetting('enableSpamFiltering', checked)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Developer Tools */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <h3 className="text-sm font-medium">Developer Tools</h3>
            </div>
            <Button
              variant={config.showPerformanceDashboard ? "default" : "outline"}
              onClick={handleTogglePerformanceDashboard}
              className="w-full"
            >
              <Activity className="mr-2 h-4 w-4" />
              {config.showPerformanceDashboard ? "Hide" : "Show"} Performance Metrics
            </Button>
            <p className="text-xs text-muted-foreground">
              Display real-time performance metrics including cache hit rates and load times.
            </p>
          </div>
          {/* Messaging Settings */}
          <MessagingSettings />

          <Separator />
        </div>
      </DialogContent>
    </Dialog>
  );
}