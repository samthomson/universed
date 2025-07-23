import { useState } from 'react';
import { Bell, MessageCircle, Heart, Reply, UserPlus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useNotifications, useMarkNotificationsRead, useUnreadNotificationCount, useBrowserNotifications, type Notification } from '@/hooks/useNotifications';
import { useAuthor } from '@/hooks/useAuthor';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { genUserName } from '@/lib/genUserName';
import { formatDistanceToNow } from 'date-fns';

function NotificationItem({ notification, onMarkRead }: {
  notification: Notification;
  onMarkRead: (id: string) => void;
}) {
  const author = useAuthor(notification.fromPubkey);
  const displayName = author.data?.metadata?.name || genUserName(notification.fromPubkey || '');

  const getIcon = () => {
    switch (notification.type) {
      case 'mention':
        return <MessageCircle className="w-4 h-4 text-blue-500" />;
      case 'reply':
        return <Reply className="w-4 h-4 text-green-500" />;
      case 'reaction':
        return <Heart className="w-4 h-4 text-red-500" />;
      case 'friend_request':
        return <UserPlus className="w-4 h-4 text-purple-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const handleClick = () => {
    if (!notification.read) {
      onMarkRead(notification.id);
    }
    // TODO: Navigate to the relevant event/conversation
  };

  return (
    <div
      className={`flex items-start space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${
        !notification.read ? 'bg-blue-50 dark:bg-blue-950/20' : ''
      }`}
      onClick={handleClick}
    >
      <div className="flex-shrink-0 mt-1">
        {getIcon()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          {notification.fromPubkey && (
            <Avatar className="w-6 h-6">
              <AvatarImage src={author.data?.metadata?.picture} alt={displayName} />
              <AvatarFallback className="text-xs">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{notification.title}</p>
            <p className="text-xs text-muted-foreground">
              {notification.fromPubkey && `${displayName} • `}
              {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
            </p>
          </div>
          {!notification.read && (
            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
          )}
        </div>

        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
          {notification.message}
        </p>
      </div>
    </div>
  );
}

function NotificationSettings() {
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useLocalStorage('browser-notifications', false);
  const [soundEnabled, setSoundEnabled] = useLocalStorage('notification-sound', true);
  const { requestPermission, permission } = useBrowserNotifications();

  const handleBrowserNotificationToggle = async (enabled: boolean) => {
    if (enabled && permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return;
    }
    setBrowserNotificationsEnabled(enabled);
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="font-medium">Notification Settings</h3>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="browser-notifications" className="text-sm">
            Browser notifications
          </Label>
          <Switch
            id="browser-notifications"
            checked={browserNotificationsEnabled}
            onCheckedChange={handleBrowserNotificationToggle}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="sound" className="text-sm">
            Sound
          </Label>
          <Switch
            id="sound"
            checked={soundEnabled}
            onCheckedChange={setSoundEnabled}
          />
        </div>
      </div>

      {permission === 'denied' && (
        <p className="text-xs text-muted-foreground">
          Browser notifications are blocked. Enable them in your browser settings.
        </p>
      )}
    </div>
  );
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { data: notifications = [] } = useNotifications();
  const unreadCount = useUnreadNotificationCount();
  const { mutate: markAsRead } = useMarkNotificationsRead();

  const handleMarkAllRead = () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length > 0) {
      markAsRead(unreadIds);
    }
  };

  const handleMarkRead = (id: string) => {
    markAsRead([id]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end">
        {showSettings ? (
          <div>
            <div className="flex items-center justify-between p-4 border-b">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(false)}
              >
                ← Back
              </Button>
              <h2 className="font-semibold">Settings</h2>
              <div /> {/* Spacer */}
            </div>
            <NotificationSettings />
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">Notifications</h2>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllRead}
                    className="text-xs"
                  >
                    Mark all read
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSettings(true)}
                  className="h-8 w-8"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Notifications List */}
            <ScrollArea className="h-96">
              {notifications.length > 0 ? (
                <div>
                  {notifications.map((notification, index) => (
                    <div key={notification.id}>
                      <NotificationItem
                        notification={notification}
                        onMarkRead={handleMarkRead}
                      />
                      {index < notifications.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bell className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                  <p className="text-xs text-muted-foreground">
                    You'll see mentions, replies, and reactions here
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}