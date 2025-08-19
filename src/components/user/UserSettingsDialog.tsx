import { Wifi, Wallet, Sun, Moon, Monitor } from "lucide-react";
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

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";

import { useTheme } from "@/hooks/useTheme";
import { genUserName } from "@/lib/genUserName";
import { MessagingSettings } from "@/components/dm/MessagingSettings";

interface UserSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserSettingsDialog({ open, onOpenChange }: UserSettingsDialogProps) {
  const { user } = useCurrentUser();
  const { theme, setTheme } = useTheme();
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

          {/* Messaging Settings */}
          <MessagingSettings />

          <Separator />
        </div>
      </DialogContent>
    </Dialog>
  );
}