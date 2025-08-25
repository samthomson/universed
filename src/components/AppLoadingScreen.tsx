import { Loader2 } from "lucide-react";

/**
 * AppLoadingScreen - Full-screen loading overlay shown during initial app data loading
 * 
 * This component blocks the entire app while the DataManager loads initial data
 * such as user communities, recent messages, and sets up persistent subscriptions.
 */
export function AppLoadingScreen() {
  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">Loading Universes</h2>
          <p className="text-sm text-muted-foreground">
            Initializing your communities and messages...
          </p>
        </div>
      </div>
    </div>
  );
}
