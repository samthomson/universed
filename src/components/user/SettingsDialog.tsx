import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wifi, Wallet, Sun, Moon, Monitor, Users, Palette, User, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RelaySelector } from "@/components/RelaySelector";
import { WalletConfigDialog } from "@/components/WalletConfigDialog";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTheme } from "@/hooks/useTheme";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useEffect, useRef, useState, useCallback } from "react";
import { useDataManager } from "@/components/DataManagerProvider";
import { useToast } from "@/hooks/useToast";

import { EditProfileForm } from "@/components/EditProfileForm";
import { useSettings, SETTINGS_TABS } from "@/contexts/settings.tsx";

export function SettingsDialog() {
  const { user } = useCurrentUser();
  const { theme, setTheme } = useTheme();
  const { settings, updateSetting } = useUserSettings();
  const { isOpen, closeSettings, activeTab, setActiveTab } = useSettings();
  const { messaging, communities } = useDataManager();
  const { toast } = useToast();

  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);
  const [isClearing, setIsClearing] = useState(false);

  // Measure content height
  const measureHeight = useCallback(() => {
    if (contentRef.current) {
      const height = contentRef.current.scrollHeight;
      setContentHeight(height);
    }
  }, []);

  // Clear all caches
  const handleClearCache = useCallback(async () => {
    setIsClearing(true);
    try {
      await Promise.all([
        messaging.resetMessageDataAndCache(),
        communities.resetCommunitiesDataAndCache(),
      ]);
      toast({
        title: "Cache Cleared",
        description: "All cached data has been cleared successfully. Data will reload from the relay.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear cache. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  }, [messaging, communities, toast]);

  // Measure height when dialog opens (initial measurement)
  useEffect(() => {
    if (isOpen && contentHeight === undefined) {
      // Small delay to ensure content is rendered
      const timer = setTimeout(measureHeight, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, contentHeight, measureHeight]);

  // Measure height when tab changes
  useEffect(() => {
    if (contentHeight !== undefined) {
      // Small delay to ensure content is fully rendered
      const timer = setTimeout(measureHeight, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab, contentHeight, measureHeight]);

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={closeSettings}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto p-0" aria-describedby={undefined}>
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-2xl font-bold">Settings</DialogTitle>
        </DialogHeader>

        <div className="flex gap-6 px-6 py-4 pb-6">
          {/* Left Sidebar - Navigation */}
          <div className="w-48 space-y-2">
            {Object.entries(SETTINGS_TABS).map(([key, value]) => {
              const Icon = {
                [SETTINGS_TABS.PROFILE]: User,
                [SETTINGS_TABS.APPEARANCE]: Palette,
                [SETTINGS_TABS.CONNECTION]: Wifi,
                [SETTINGS_TABS.WALLET]: Wallet,
                [SETTINGS_TABS.COMMUNITIES]: Users,

              }[value];

              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(value)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors focus:outline-none ${
                    activeTab === value
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{key.charAt(0) + key.slice(1).toLowerCase()}</span>
                </button>
              );
            })}
          </div>

          {/* Right Content Area */}
          <div
            className="flex-1 transition-all duration-500 ease-in-out"
            style={{ height: contentHeight ? `${contentHeight}px` : 'auto' }}
          >
            <div ref={contentRef}>
              {activeTab === SETTINGS_TABS.PROFILE && (
                <div className="space-y-6 animate-in fade-in-0 duration-200">
                  <div>
                    <h2 className="text-base font-semibold mb-2">Profile</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Update your profile information and settings.
                    </p>
                    <EditProfileForm />
                  </div>
                </div>
              )}

              {activeTab === SETTINGS_TABS.APPEARANCE && (
                <div className="space-y-6 animate-in fade-in-0 duration-200">
                  <div>
                    <h2 className="text-base font-semibold mb-2">Appearance</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Choose your preferred theme for the application.
                    </p>
                    <div className="grid grid-cols-3 gap-3">
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
                </div>
              )}

              {activeTab === SETTINGS_TABS.CONNECTION && (
                <div className="space-y-6 animate-in fade-in-0 duration-200">
                  <div>
                    <h2 className="text-base font-semibold mb-2">Connection</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Choose which relay to connect to for sending and receiving messages.
                    </p>
                    <RelaySelector className="w-full max-w-md" />
                  </div>

                  <div className="pt-4 border-t">
                    <h2 className="text-base font-semibold mb-2">Cache Management</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Clear cached data to force reload from the relay. Use this if you're experiencing sync issues.
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleClearCache}
                      disabled={isClearing}
                      className="flex items-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      {isClearing ? "Clearing..." : "Clear All Cache"}
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === SETTINGS_TABS.WALLET && (
                <div className="space-y-6 animate-in fade-in-0 duration-200">
                  <div>
                    <h2 className="text-base font-semibold mb-2">Wallet</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure your Lightning wallet connections for Nostr Wallet Connect (NWC) payments.
                    </p>
                    <WalletConfigDialog />
                  </div>
                </div>
              )}

              {activeTab === SETTINGS_TABS.COMMUNITIES && (
                <div className="space-y-6 animate-in fade-in-0 duration-200">
                  <div>
                    <h2 className="text-base font-semibold mb-6">Communities</h2>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <Label htmlFor="show-pending" className="text-base">Show Pending Communities</Label>
                          <p className="text-sm text-muted-foreground">
                            Display communities you've requested to join in the sidebar
                          </p>
                        </div>
                        <Switch
                          id="show-pending"
                          checked={settings.showPendingCommunities}
                          onCheckedChange={(checked) => updateSetting('showPendingCommunities', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <Label htmlFor="spam-filtering" className="text-base">Enable Spam Filtering</Label>
                          <p className="text-sm text-muted-foreground">
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
                </div>
              )}


            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
