import { Clock, Globe } from 'lucide-react';
import { getUserTimezone, formatEventDateTime } from '@/lib/eventTimezone';
import type { NostrEvent } from '@nostrify/nostrify';

interface TimezoneDisplayProps {
  event: NostrEvent;
  showLocalTime?: boolean;
  className?: string;
}

export function TimezoneDisplay({
  event,
  showLocalTime = true,
  className = '',
}: TimezoneDisplayProps) {
  const startTime = event.tags.find((tag) => tag[0] === 'start')?.[1];
  const endTime = event.tags.find((tag) => tag[0] === 'end')?.[1];
  const startTzid = event.tags.find((tag) => tag[0] === 'start_tzid')?.[1];
  const endTzid = event.tags.find((tag) => tag[0] === 'end_tzid')?.[1];

  if (!startTime) {
    return <span className="text-muted-foreground">No time specified</span>;
  }

  const eventTimezone = startTzid || endTzid;
  const userTimezone = getUserTimezone();
  const isLocalTimezone = eventTimezone === userTimezone;

  const getFormattedTime = () => {
    try {
      if (event.kind === 31922) {
        // Date-based events (YYYY-MM-DD format)
        const startDate = new Date(startTime + 'T00:00:00');
        
        if (endTime && endTime !== startTime) {
          const endDate = new Date(endTime + 'T00:00:00');
          
          if (startDate.toDateString() === endDate.toDateString()) {
            return {
              eventTime: formatEventDateTime(startDate.getTime(), eventTimezone),
              localTime: showLocalTime && !isLocalTimezone
                ? formatEventDateTime(startDate.getTime(), userTimezone)
                : null,
            };
          }

          return {
            eventTime: `${formatEventDateTime(startDate.getTime(), eventTimezone)} - ${formatEventDateTime(endDate.getTime(), eventTimezone)}`,
            localTime: showLocalTime && !isLocalTimezone
              ? `${formatEventDateTime(startDate.getTime(), userTimezone)} - ${formatEventDateTime(endDate.getTime(), userTimezone)}`
              : null,
          };
        }

        return {
          eventTime: formatEventDateTime(startDate.getTime(), eventTimezone),
          localTime: showLocalTime && !isLocalTimezone
            ? formatEventDateTime(startDate.getTime(), userTimezone)
            : null,
        };
      } else {
        // Time-based events (unix timestamp)
        let timestamp = parseInt(startTime);
        
        // Handle both seconds and milliseconds timestamps
        if (timestamp < 10000000000) {
          timestamp = timestamp * 1000;
        }
        
        const startDate = new Date(timestamp);
        if (isNaN(startDate.getTime())) {
          throw new Error('Invalid start date');
        }

        if (endTime) {
          let endTimestamp = parseInt(endTime);
          
          if (endTimestamp < 10000000000) {
            endTimestamp = endTimestamp * 1000;
          }
          
          const endDate = new Date(endTimestamp);
          if (!isNaN(endDate.getTime())) {
            const startDateTime = formatEventDateTime(
              startDate.getTime(),
              eventTimezone,
              {
                hour: 'numeric',
                minute: 'numeric',
              }
            );
            const endTimeOnly = endDate.toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: 'numeric',
              timeZone: eventTimezone,
            });

            const timezoneAbbr = eventTimezone ? ` (${eventTimezone})` : '';

            return {
              eventTime: `${startDateTime} - ${endTimeOnly}${timezoneAbbr}`,
              localTime: showLocalTime && !isLocalTimezone
                ? `${formatEventDateTime(startDate.getTime(), userTimezone, {
                    hour: 'numeric',
                    minute: 'numeric',
                  })} - ${endDate.toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: 'numeric',
                    timeZone: userTimezone,
                  })} (${userTimezone})`
                : null,
            };
          }
        }

        const startDateTime = formatEventDateTime(
          startDate.getTime(),
          eventTimezone,
          {
            hour: 'numeric',
            minute: 'numeric',
          }
        );

        const timezoneAbbr = eventTimezone ? ` (${eventTimezone})` : '';

        return {
          eventTime: `${startDateTime}${timezoneAbbr}`,
          localTime: showLocalTime && !isLocalTimezone
            ? `${formatEventDateTime(startDate.getTime(), userTimezone, {
                hour: 'numeric',
                minute: 'numeric',
              })} (${userTimezone})`
            : null,
        };
      }
    } catch (error) {
      console.error('Error formatting event time:', error);
      return {
        eventTime: 'Invalid date',
        localTime: null,
      };
    }
  };

  const { eventTime, localTime } = getFormattedTime();

  // Show a warning if no timezone was detected for the event
  const noTimezoneDetected = !eventTimezone;

  if (!showLocalTime || !localTime || isLocalTimezone) {
    return (
      <div className={`space-y-1 ${className}`}>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>{eventTime}</span>
        </div>
        {noTimezoneDetected && (
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-amber-600">
              Timezone not specified - showing in your local time
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span>{eventTime}</span>
      </div>
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {localTime} (your time)
        </span>
      </div>
      {noTimezoneDetected && (
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-amber-500" />
          <span className="text-xs text-amber-600">
            Event timezone not specified
          </span>
        </div>
      )}
    </div>
  );
}