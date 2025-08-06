import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { NoteContent } from '@/components/NoteContent';
import { CalendarEventCard } from '@/components/CalendarEventCard';
import { useAuthor } from '@/hooks/useAuthor';
import { useEventById } from '@/hooks/useEventById';
import { genUserName } from '@/lib/genUserName';
import { formatDistanceToNowShort } from '@/lib/formatTime';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface InlineEventProps {
  eventId: string;
  className?: string;
  showHeader?: boolean;
  maxContentLength?: number;
}

export function InlineEvent({
  eventId,
  className,
  showHeader = true,
  maxContentLength = 300
}: InlineEventProps) {
  const { data: event, isLoading, error } = useEventById(eventId);
  const author = useAuthor(event?.pubkey);

  if (isLoading) {
    return (
      <Card className={`w-full ${className}`}>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !event) {
    return (
      <Card className={`w-full border-destructive/50 ${className}`}>
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">Event not found or failed to load</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              ID: {eventId.slice(0, 20)}...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if this is a NIP-52 calendar event
  const isCalendarEvent = event.kind === 31922 || event.kind === 31923;

  // If it's a calendar event, use the specialized CalendarEventCard
  if (isCalendarEvent) {
    return (
      <CalendarEventCard 
        event={event} 
        className={className}
        compact={true}
      />
    );
  }

  const metadata = author.data?.metadata;
  const displayName = metadata?.name || genUserName(event.pubkey);
  const profileImage = metadata?.picture;
  const timestamp = new Date(event.created_at * 1000);

  // Truncate content if it's too long
  const content = event.content.length > maxContentLength
    ? event.content.slice(0, maxContentLength) + '...'
    : event.content;

  return (
    <Card className={`w-full hover:shadow-md transition-shadow ${className}`}>
      {showHeader && (
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={profileImage} alt={displayName} />
              <AvatarFallback className="text-xs">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm leading-none">{displayName}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNowShort(timestamp, { addSuffix: true })}
              </p>
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent className={showHeader ? 'pt-0' : 'p-4'}>
        <div className="text-sm">
          <NoteContent event={{ ...event, content }} className="leading-relaxed" />
        </div>
        <div className="mt-3 space-y-2">
          {event.content.length > maxContentLength && (
            <button
              className="text-xs text-blue-500 hover:underline block"
              onClick={() => {
                // Navigate to full event view
                window.open(`/${eventId}`, '_blank');
              }}
            >
              View full event
            </button>
          )}
          <a
            href={`https://njump.me/${eventId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors block"
          >
            View on njump.me →
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

// Component to render multiple inline events
interface InlineEventsProps {
  eventIds: string[];
  className?: string;
  maxItems?: number;
}

export function InlineEvents({ eventIds, className, maxItems = 3 }: InlineEventsProps) {
  const displayIds = eventIds.slice(0, maxItems);
  const remainingCount = eventIds.length - maxItems;

  return (
    <div className={`space-y-3 ${className}`}>
      {displayIds.map((eventId) => (
        <InlineEvent
          key={eventId}
          eventId={eventId}
          showHeader={true}
          maxContentLength={200}
        />
      ))}
      {remainingCount > 0 && (
        <div className="text-center">
          <button
            className="text-sm text-blue-500 hover:underline"
            onClick={() => {
              // Navigate to a page showing all events
              console.log('Show all events:', eventIds);
            }}
          >
            +{remainingCount} more events
          </button>
        </div>
      )}
    </div>
  );
}