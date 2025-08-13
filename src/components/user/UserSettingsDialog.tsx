import { LogOut, Wifi, Activity, Wallet, Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { RelaySelector } from "@/components/RelaySelector";
import { WalletConfigDialog } from "@/components/WalletConfigDialog";
import { useLoginActions } from "@/hooks/useLoginActions";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";
import { useAppContext } from "@/hooks/useAppContext";
import { useTheme } from "@/hooks/useTheme";
import { genUserName } from "@/lib/genUserName";

interface UserSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserSettingsDialog({ open, onOpenChange }: UserSettingsDialogProps) {
  const { logout } = useLoginActions();
  const { user } = useCurrentUser();
  const { config, updateConfig } = useAppContext();
  const { theme, setTheme } = useTheme();
  const author = useAuthor(user?.pubkey || '');
  const metadata = author.data?.metadata;

  if (!user) return null;

  const displayName = metadata?.name || genUserName(user.pubkey);

  const handleLogout = async () => {
    await logout();
    onOpenChange(false);
  };

  const handleTogglePerformanceDashboard = () => {
    updateConfig((current) => ({
      ...current,
      showPerformanceDashboard: !current.showPerformanceDashboard,
    }));
  };

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

          <Separator />

          {/* Account Actions */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Account</h3>
            <Button
              variant="destructive"
              onClick={handleLogout}
              className="w-full"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </Button>
            <p className="text-xs text-muted-foreground">
              You'll need to log in again to access your account.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}