import { LogOut, Wifi } from "lucide-react";
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
import { useLoginActions } from "@/hooks/useLoginActions";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";

interface UserSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserSettingsDialog({ open, onOpenChange }: UserSettingsDialogProps) {
  const { logout } = useLoginActions();
  const { user } = useCurrentUser();
  const author = useAuthor(user?.pubkey || '');
  const metadata = author.data?.metadata;

  if (!user) return null;

  const displayName = metadata?.name || genUserName(user.pubkey);

  const handleLogout = async () => {
    await logout();
    onOpenChange(false);
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