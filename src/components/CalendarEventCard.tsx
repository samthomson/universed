import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Calendar, MapPin, User, Check, X, Clock3, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useRSVPStatus, type RSVPStatus } from '@/hooks/useRSVPStatus';
import { genUserName } from '@/lib/genUserName';
import { formatDistanceToNowShort } from '@/lib/formatTime';
import { cn } from '@/lib/utils';
import { TimezoneDisplay } from '@/components/TimezoneDisplay';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';

interface CalendarEventCardProps {
  event: NostrEvent;
  className?: string;
  compact?: boolean;
  onEditEvent?: (event: NostrEvent) => void;
}


export function CalendarEventCard({ event, className, compact = false, onEditEvent }: CalendarEventCardProps) {
  const { user } = useCurrentUser();
  const { mutate: createEvent } = useNostrPublish();
  const [isRSVPing, setIsRSVPing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Get current RSVP status
  const { status: currentRSVP, isLoading: rsvpLoading, refetch: refetchRSVP } = useRSVPStatus(event);
  
  const author = useAuthor(event.pubkey);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || genUserName(event.pubkey);
  const profileImage = metadata?.picture;

  // Extract event data from tags
  const getTags = (tagName: string) => 
    event.tags.filter(tag => tag[0] === tagName).map(tag => tag[1]);

  const getTag = (tagName: string) => 
    event.tags.find(tag => tag[0] === tagName)?.[1];

  const title = getTag('title') || 'Untitled Event';
  const summary = getTag('summary');
  const image = getTag('image');
  const location = getTags('location')[0]; // Just show first location
  const startTime = getTag('start');
  // const endTime = getTag('end');
  // const startTzid = getTag('start_tzid');

  // Check if current user is the event author
  const isEventAuthor = user && user.pubkey === event.pubkey;

  // Determine if it's a date-based (31922) or time-based (31923) event
  // const isDateBased = event.kind === 31922;
  // const isTimeBased = event.kind === 31923;

  const handleRSVP = async (status: RSVPStatus) => {
    if (!user) return;
    
    setIsRSVPing(true);
    
    try {
      // Create RSVP event (kind 31925) according to NIP-52
      const dTag = getTag('d');
      if (!dTag) {
        console.error('Calendar event missing d tag');
        return;
      }

      const rsvpTags = [
        ['a', `${event.kind}:${event.pubkey}:${dTag}`],
        ['e', event.id],
        ['d', `${event.id}-${Date.now()}`], // Unique identifier for this RSVP
        ['status', status],
        ['p', event.pubkey], // Tag the event author
      ];

      createEvent({
        kind: 31925,
        content: '',
        tags: rsvpTags,
      });

      // Refetch RSVP status to show the updated state
      setTimeout(() => refetchRSVP(), 1000); // Small delay to allow the event to propagate
    } catch (error) {
      console.error('Failed to RSVP:', error);
    } finally {
      setIsRSVPing(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!user || !isEventAuthor) return;
    
    setIsDeleting(true);
    
    try {
      // Create a deletion event (kind 5) according to NIP-09
      const deleteReason = 'Event deleted by organizer';
      
      createEvent({
        kind: 5,
        content: deleteReason,
        tags: [
          ['e', event.id, '', 'Event deleted by organizer'],
        ],
      }, {
        onSuccess: () => {
          toast.success('Event deleted successfully');
          setShowDeleteDialog(false);
        },
        onError: (error) => {
          console.error('Failed to delete event:', error);
          toast.error('Failed to delete event');
        }
      });
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditEvent = () => {
    if (onEditEvent) {
      onEditEvent(event);
    }
  };

  return (
    <Card className={cn("w-full hover:shadow-md transition-shadow", className)}>
      <CardHeader className={cn("pb-3", compact && "pb-2")}>
        <div className="flex items-start space-x-3">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={profileImage} alt={displayName} />
            <AvatarFallback className="text-xs">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <p className="font-medium text-sm leading-none truncate">{displayName}</p>
              <Badge variant="secondary" className="text-xs">
                <Calendar className="w-3 h-3 mr-1" />
                Event
              </Badge>
              {currentRSVP && !rsvpLoading && (
                <Badge 
                  variant={currentRSVP === 'accepted' ? 'default' : currentRSVP === 'declined' ? 'destructive' : 'secondary'} 
                  className="text-xs"
                >
                  {currentRSVP === 'accepted' ? 'Going' : currentRSVP === 'tentative' ? 'Maybe' : 'Not Going'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNowShort(new Date(event.created_at * 1000), { addSuffix: true })}
            </p>
          </div>
          {/* Event Actions Menu (only for event author) */}
          {isEventAuthor && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEditEvent} disabled={!onEditEvent}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Event
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)} 
                  disabled={isDeleting}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Event
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Event Image */}
        {image && !compact && (
          <div className="aspect-video w-full overflow-hidden rounded-lg">
            <img
              src={image}
              alt={title}
              className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
              onClick={() => window.open(image, '_blank')}
            />
          </div>
        )}

        {/* Event Title */}
        <div>
          <h3 className={cn("font-semibold leading-tight", compact ? "text-sm" : "text-base")}>
            {title}
          </h3>
        </div>

        {/* Date/Time with proper timezone handling */}
        {startTime && (
          <TimezoneDisplay 
            event={event} 
            showLocalTime={true} 
            className="text-sm"
          />
        )}

        {/* Location */}
        {location && (
          <div className="flex items-center text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="truncate">{location}</span>
          </div>
        )}

        {/* Summary/Description */}
        {summary && !compact && (
          <div className="text-sm text-muted-foreground">
            <p className="line-clamp-2">{summary}</p>
          </div>
        )}

        {/* Full description from content if no summary */}
        {!summary && event.content && !compact && (
          <div className="text-sm text-muted-foreground">
            <p className="line-clamp-2">{event.content}</p>
          </div>
        )}

        {/* RSVP Buttons */}
        {user && (
          <div className="flex items-center space-x-2 pt-2 border-t">
            <div className="flex items-center text-xs text-muted-foreground mr-2">
              <User className="w-3 h-3 mr-1" />
              RSVP:
            </div>
            <div className="flex space-x-1">
              <Button
                size="sm"
                variant={currentRSVP === 'accepted' ? 'default' : 'outline'}
                disabled={isRSVPing || rsvpLoading}
                onClick={() => handleRSVP('accepted')}
                className="h-7 px-2 text-xs"
              >
                <Check className="w-3 h-3 mr-1" />
                Yes
              </Button>
              <Button
                size="sm"
                variant={currentRSVP === 'tentative' ? 'default' : 'outline'}
                disabled={isRSVPing || rsvpLoading}
                onClick={() => handleRSVP('tentative')}
                className="h-7 px-2 text-xs"
              >
                <Clock3 className="w-3 h-3 mr-1" />
                Maybe
              </Button>
              <Button
                size="sm"
                variant={currentRSVP === 'declined' ? 'destructive' : 'outline'}
                disabled={isRSVPing || rsvpLoading}
                onClick={() => handleRSVP('declined')}
                className="h-7 px-2 text-xs"
              >
                <X className="w-3 h-3 mr-1" />
                No
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteEvent}
        title="Delete Event"
        description="Are you sure you want to delete this event? This action cannot be undone and will remove the event for all participants."
        confirmText={isDeleting ? "Deleting..." : "Delete Event"}
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeleting}
      />
    </Card>
  );
}