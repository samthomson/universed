import { useState } from 'react';
import { Bell, MessageCircle, Heart, Reply, UserPlus, Settings, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotifications, useMarkNotificationsRead, useUnreadNotificationCount, useBrowserNotifications, type Notification } from '@/hooks/useNotifications';
import { useAuthor } from '@/hooks/useAuthor';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { genUserName } from '@/lib/genUserName';
import { formatDistanceToNowShort } from '@/lib/formatTime';
import { useIsMobile } from '@/hooks/useIsMobile';

// Small, focused building blocks to keep the file readable

// (was used earlier; now replaced by NotificationsPanel)

// Settings header is simple and used only once, so it's inlined where rendered


const SettingsPanel = ({ onBack }: { onBack: () => void }) => {

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
    <div>
      <div className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <h2 className="font-semibold">Settings</h2>
        <div />
      </div>
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
    </div>
  )
};

const NotificationSkeleton = () => {
  return (
    <div className="flex items-start space-x-3 p-3">
      <Skeleton className="w-4 h-4 rounded-full mt-1" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center space-x-2">
          <Skeleton className="w-6 h-6 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}

const NotificationItem = ({ notification, onMarkRead }: {
  notification: Notification;
  onMarkRead: (id: string) => void;
}) => {
  const [copied, setCopied] = useState(false);
  const isMobile = useIsMobile();
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

  const handleCopyId = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!notification.eventId) return;
    try {
      await navigator.clipboard.writeText(notification.eventId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // no-op
    }
  };

  return (
    <div
      className={`relative group flex items-start space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${!notification.read ? 'bg-blue-50 dark:bg-blue-950/20' : ''
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
              {formatDistanceToNowShort(notification.timestamp, { addSuffix: true })}
            </p>
          </div>
          {!notification.read && (
            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
          )}
        </div>

        <p className={`text-sm text-muted-foreground mt-1 line-clamp-2 ${notification.eventId ? 'pr-10' : ''}`}>
          {notification.message}
        </p>
      </div>
      {notification.eventId && (
        <button
          onClick={handleCopyId}
          title="Copy event ID"
          className={`absolute right-1 bottom-3 h-6 w-6 flex items-center justify-center rounded ${isMobile ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity text-muted-foreground hover:text-foreground`}
          aria-label="Copy event ID"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}

const NotificationsList = ({ notifications, isLoading, handleMarkRead }: { notifications: Notification[], isLoading: boolean, handleMarkRead: (id: string) => void }) => {
  if (isLoading) {
    return (
      <div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i}>
            <NotificationSkeleton />
            {i < 4 && <Separator />}
          </div>
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Bell className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">No notifications yet</p>
        <p className="text-xs text-muted-foreground">You'll see mentions, replies, and reactions here</p>
      </div>
    );
  }

  return (
    <div>
      {notifications.map((notification, index) => (
        <div key={notification.id}>
          <NotificationItem notification={notification} onMarkRead={handleMarkRead} />
          {index < notifications.length - 1 && <Separator />}
        </div>
      ))}
    </div>
  );
}

const NotificationsPanel = ({
  unreadCount: uc,
  onMarkAllRead: onAllRead,
  onOpenSettings,
  notifications,
  isLoading,
  handleMarkRead,
}: {
  unreadCount: number;
  onMarkAllRead: () => void;
  onOpenSettings: () => void;
  notifications: Notification[];
  isLoading: boolean;
  handleMarkRead: (id: string) => void;
}) => {
  const isMobile = useIsMobile();
  return (
    <div>
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold">Notifications</h2>
        <div className="flex items-center space-x-2">
          {uc > 0 && (
            <Button variant="ghost" size="sm" onClick={onAllRead} className="text-xs">
              Mark all read
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onOpenSettings} className="h-8 w-8">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className={`overflow-y-auto scrollbar-thin ${isMobile ? 'max-h-[80vh]' : 'max-h-[50vh]'}`}>
        <NotificationsList notifications={notifications} isLoading={isLoading} handleMarkRead={handleMarkRead} />
      </div>
    </div>
  )
};

export const NotificationCenter = () => {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const isMobile = useIsMobile();

  const { data: notifications = [], isLoading } = useNotifications();
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

  // Popover sizing: wider on desktop; full width on mobile
  const popoverWidthClass = isMobile ? 'w-[calc(100vw-1rem)]' : 'w-96';
  const popoverMarginClass = isMobile ? 'ml-0' : 'ml-2';
  const popoverSide = isMobile ? 'bottom' : 'right';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative w-12 h-12 rounded-2xl hover:rounded-xl hover:bg-gray-800/60 transition-all duration-200"
        >
          <Bell className="h-6 w-6" />
          {unreadCount > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={`${popoverWidthClass} p-0 ${popoverMarginClass}`}
        align="start"
        side={popoverSide as 'right' | 'left' | 'top' | 'bottom'}
        collisionPadding={8}
      >
        {showSettings ? (
          <SettingsPanel onBack={() => setShowSettings(false)} />
        ) : (
          <NotificationsPanel
            unreadCount={unreadCount}
            onMarkAllRead={handleMarkAllRead}
            onOpenSettings={() => setShowSettings(true)}
            notifications={notifications}
            isLoading={isLoading}
            handleMarkRead={handleMarkRead}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}