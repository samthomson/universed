import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle, Clock, Users, MoreHorizontal, Trash2 } from 'lucide-react';
import { type NostrEvent } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { formatDistanceToNowShort } from '@/lib/formatTime';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';

interface PollOption {
  id: string;
  label: string;
}

interface PollCardProps {
  event: NostrEvent;
  className?: string;
  compact?: boolean;
  showHeader?: boolean;
}

function validatePollEvent(event: NostrEvent): boolean {
  // Check if it's a poll event kind
  if (event.kind !== 1068) return false;

  // Check for required tags according to NIP-88
  const options = event.tags.filter(([name]) => name === 'option');
  
  // Polls must have at least 2 options
  if (options.length < 2) return false;

  // Each option must have an ID and label
  for (const option of options) {
    if (option.length < 3 || !option[1] || !option[2]) return false;
  }

  return true;
}

function usePollResponses(pollEvent: NostrEvent) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['poll-responses', pollEvent.id],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Get endsAt timestamp if available
      const endsAtTag = pollEvent.tags.find(([name]) => name === 'endsAt')?.[1];
      const pollExpiration = endsAtTag ? parseInt(endsAtTag) : undefined;

      const filter: {
        kinds: number[];
        '#e': string[];
        limit: number;
        until?: number;
      } = {
        kinds: [1018],
        '#e': [pollEvent.id],
        limit: 1000,
      };

      // Only include responses before poll expiration
      if (pollExpiration) {
        filter.until = pollExpiration;
      }

      const events = await nostr.query([filter], { signal });
      
      // Filter to one vote per pubkey (latest vote wins)
      const eventMap = new Map<string, NostrEvent>();
      
      events.forEach((event) => {
        if (
          !eventMap.has(event.pubkey) ||
          event.created_at > eventMap.get(event.pubkey)!.created_at
        ) {
          eventMap.set(event.pubkey, event);
        }
      });

      return Array.from(eventMap.values());
    },
    enabled: !!pollEvent,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });
}

export function PollCard({ event, className, compact = false, showHeader = true }: PollCardProps) {
  const { user } = useCurrentUser();
  const { mutate: createEvent } = useNostrPublish();
  const author = useAuthor(event.pubkey);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Check if current user is the poll author
  const isPollAuthor = user && user.pubkey === event.pubkey;

  // Extract poll data from event
  const pollOptions: PollOption[] = event.tags
    .filter(([name]) => name === 'option')
    .map(([_, id, label]) => ({ id, label }));

  const pollType = event.tags.find(([name]) => name === 'polltype')?.[1] || 'singlechoice';
  const endsAtTag = event.tags.find(([name]) => name === 'endsAt')?.[1];
  const endsAt = endsAtTag ? new Date(parseInt(endsAtTag) * 1000) : null;
  const isExpired = !!(endsAt && endsAt < new Date());

  // Fetch poll responses
  const { data: responses = [], isLoading: loadingResponses } = usePollResponses(event);

  // Check if current user has already voted
  const userResponse: NostrEvent | undefined = user ? responses.find(r => r.pubkey === user.pubkey) : undefined;
  const userVotedOptions = userResponse?.tags
    .filter(([name]) => name === 'response')
    .map(([_, optionId]) => optionId) || [];

  // Calculate results
  const results = useMemo(() => {
    const voteCounts: Record<string, number> = {};
    pollOptions.forEach(option => {
      voteCounts[option.id] = 0;
    });

    responses.forEach(response => {
      const responseOptions = response.tags
        .filter(([name]) => name === 'response')
        .map(([_, optionId]) => optionId);

      if (pollType === 'singlechoice') {
        // Only count the first response for single choice polls
        if (responseOptions[0]) {
          voteCounts[responseOptions[0]] = (voteCounts[responseOptions[0]] || 0) + 1;
        }
      } else {
        // Count unique responses for multiple choice polls
        const uniqueOptions = [...new Set(responseOptions)];
        uniqueOptions.forEach(optionId => {
          voteCounts[optionId] = (voteCounts[optionId] || 0) + 1;
        });
      }
    });

    const totalVotes = Object.values(voteCounts).reduce((sum, count) => sum + count, 0);

    return pollOptions.map(option => ({
      ...option,
      votes: voteCounts[option.id] || 0,
      percentage: totalVotes > 0 ? (voteCounts[option.id] || 0) / totalVotes * 100 : 0,
    }));
  }, [responses, pollOptions, pollType]);

  const totalVotes = results.reduce((sum, option) => sum + option.votes, 0);

  // Validate poll event after all hooks are called
  if (!validatePollEvent(event)) {
    return (
      <Card className={cn("border-destructive/50", className)}>
        <CardContent className="p-4">
          <div className="text-center text-destructive">
            <p className="text-sm">Invalid poll format</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleOptionSelect = (optionId: string) => {
    if ((userResponse !== undefined) || isExpired) return; // Can't vote if already voted or poll expired

    if (pollType === 'singlechoice') {
      setSelectedOptions([optionId]);
    } else {
      setSelectedOptions(prev => 
        prev.includes(optionId) 
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      );
    }
  };

  const handleVote = () => {
    if (!user || selectedOptions.length === 0 || (userResponse !== undefined) || isExpired) return;

    const responseTags = selectedOptions.map(optionId => ['response', optionId]);

    createEvent({
      kind: 1018,
      content: '',
      tags: [
        ['e', event.id],
        ...responseTags,
      ],
    });

    setSelectedOptions([]);
  };

  const handleDeletePoll = async () => {
    if (!user || !isPollAuthor) return;
    
    setIsDeleting(true);
    
    try {
      // Create a deletion event (kind 5) according to NIP-09
      const deleteReason = 'Poll deleted by author';
      
      createEvent({
        kind: 5,
        content: deleteReason,
        tags: [
          ['e', event.id, '', 'Poll deleted by author'],
        ],
      }, {
        onSuccess: () => {
          toast.success('Poll deleted successfully');
          setShowDeleteDialog(false);
        },
        onError: (error) => {
          console.error('Failed to delete poll:', error);
          toast.error('Failed to delete poll');
        }
      });
    } catch (error) {
      console.error('Error deleting poll:', error);
      toast.error('Failed to delete poll');
    } finally {
      setIsDeleting(false);
    }
  };

  const metadata = author.data?.metadata;
  const displayName = metadata?.name || genUserName(event.pubkey);
  const profileImage = metadata?.picture;
  const timestamp = new Date(event.created_at * 1000);

  if (loadingResponses && !compact) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </CardHeader>
        )}
        <CardContent className={showHeader ? 'pt-0' : 'p-4'}>
          <div className="space-y-4">
            <Skeleton className="h-6 w-3/4" />
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("hover:shadow-md transition-shadow", className)}>
      {showHeader && (
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={profileImage} alt={displayName} />
              <AvatarFallback className="text-xs">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium text-sm leading-none">{displayName}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNowShort(timestamp, { addSuffix: true })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isExpired ? "secondary" : "default"} className="text-xs">
                {isExpired ? "Ended" : "Active"}
              </Badge>
              {pollType === 'multiplechoice' && (
                <Badge variant="outline" className="text-xs">
                  Multi-choice
                </Badge>
              )}
              {/* Poll Actions Menu (only for poll author) */}
              {isPollAuthor && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteDialog(true)} 
                      disabled={isDeleting}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Poll
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardHeader>
      )}

      <CardContent className={cn("space-y-4", showHeader && !compact ? 'pt-0' : 'p-4')}>
        {/* Poll Question */}
        <div>
          <h3 className={cn("font-medium", compact ? "text-sm" : "text-base")}>
            {event.content}
          </h3>
          {endsAt && !compact && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {isExpired ? "Ended" : "Ends"} {formatDistanceToNowShort(endsAt, { addSuffix: true })}
            </div>
          )}
        </div>

        {/* Poll Options */}
        <div className="space-y-2">
          {results.map((option) => {
            const isSelected = selectedOptions.includes(option.id);
            const isUserVoted = userVotedOptions.includes(option.id);
            const showResults = (userResponse !== undefined) || isExpired;

            return (
              <div key={option.id} className="relative">
                <Button
                  variant={isSelected ? "default" : "outline"}
                  className={cn(
                    "w-full justify-start text-left h-auto p-3 relative overflow-hidden",
                    showResults && "cursor-default",
                    isUserVoted && showResults && "border-primary bg-primary/10"
                  )}
                  onClick={() => handleOptionSelect(option.id)}
                  disabled={(userResponse !== undefined) || isExpired}
                >
                  {/* Progress background for results */}
                  {showResults && (
                    <div 
                      className="absolute inset-0 bg-muted transition-all duration-300"
                      style={{ width: `${option.percentage}%` }}
                    />
                  )}
                  
                  {/* Option content */}
                  <div className="flex items-center justify-between w-full relative z-10">
                    <div className="flex items-center gap-2">
                      {isSelected && !showResults && <CheckCircle className="h-4 w-4" />}
                      {isUserVoted && showResults && <CheckCircle className="h-4 w-4 text-primary" />}
                      <span className={compact ? "text-xs" : "text-sm"}>{option.label}</span>
                    </div>
                    
                    {showResults && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{option.votes} {option.votes === 1 ? 'vote' : 'votes'}</span>
                        <span className="font-medium">{option.percentage.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                </Button>
              </div>
            );
          })}
        </div>

        {/* Vote Button */}
        {(userResponse === undefined) && !isExpired && selectedOptions.length > 0 && user && (
          <Button 
            onClick={handleVote} 
            className="w-full"
            size={compact ? "sm" : "default"}
          >
            Vote
          </Button>
        )}

        {/* Login prompt */}
        {!user && !isExpired && (
          <div className="text-center text-sm text-muted-foreground py-2">
            Log in to vote in this poll
          </div>
        )}

        {/* Poll stats */}
        {!compact && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</span>
            </div>
            <div className="flex items-center gap-4">
              {endsAt && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {isExpired ? "Ended" : "Ends"} {formatDistanceToNowShort(endsAt, { addSuffix: true })}
                </div>
              )}
              <Badge variant="outline" className="text-xs">
                NIP-88 Poll
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
      
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeletePoll}
        title="Delete Poll"
        description="Are you sure you want to delete this poll? This action cannot be undone and will remove the poll and all votes."
        confirmText={isDeleting ? "Deleting..." : "Delete Poll"}
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeleting}
      />
    </Card>
  );
}