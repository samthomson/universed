import { Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessagingSettings } from "./MessagingSettings";

interface MessagingSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MessagingSettingsDialog({ open, onOpenChange }: MessagingSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Messaging Settings
          </DialogTitle>
          <DialogDescription>
            Configure your direct message preferences and protocol settings.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <MessagingSettings />
        </div>
      </DialogContent>
    </Dialog>
  );
}
