import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wifi, Wallet, Sun, Moon, Monitor, Users, MessageSquare, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useSettings, SETTINGS_TABS } from "@/contexts/settings.tsx";

export function UserSettingsDialog() {
  const { user } = useCurrentUser();
  const { theme, setTheme } = useTheme();
  const { settings, updateSetting } = useUserSettings();
  const author = useAuthor(user?.pubkey || '');
  const metadata = author.data?.metadata;
  const { isOpen, closeSettings, activeTab, setActiveTab } = useSettings();

  if (!user) return null;

  const displayName = metadata?.name || genUserName(user.pubkey);

  return (
    <Dialog open={isOpen} onOpenChange={closeSettings}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your account settings and preferences for {displayName}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-6 py-4">
          {/* Left Sidebar - Navigation */}
          <div className="w-48 space-y-2">
            {Object.entries(SETTINGS_TABS).map(([key, value]) => {
              const Icon = {
                [SETTINGS_TABS.APPEARANCE]: Palette,
                [SETTINGS_TABS.CONNECTION]: Wifi,
                [SETTINGS_TABS.WALLET]: Wallet,
                [SETTINGS_TABS.COMMUNITIES]: Users,
                [SETTINGS_TABS.MESSAGING]: MessageSquare,
              }[value];

              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(value)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
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
          <div className="flex-1 min-w-0">
            {activeTab === SETTINGS_TABS.APPEARANCE && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Theme</h3>
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
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Relay Connection</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Choose which relay to connect to for sending and receiving messages.
                  </p>
                  <RelaySelector className="w-full max-w-md" />
                </div>
              </div>
            )}

            {activeTab === SETTINGS_TABS.WALLET && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Wallet Configuration</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure your Lightning wallet connections for Nostr Wallet Connect (NWC) payments.
                  </p>
                  <WalletConfigDialog />
                </div>
              </div>
            )}

            {activeTab === SETTINGS_TABS.COMMUNITIES && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Community Settings</h3>
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

            {activeTab === SETTINGS_TABS.MESSAGING && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Messaging Settings</h3>
                  <MessagingSettings />
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}