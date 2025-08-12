import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';

interface PollOption {
  id: string;
  label: string;
}

interface PollCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPollCreated?: (prePopulatedContent: string, eventType: 'poll', eventData: NostrEvent) => void;
  communityId?: string;
  channelId?: string;
}

export function PollCreationDialog({ open, onOpenChange, onPollCreated, communityId: _communityId, channelId: _channelId }: PollCreationDialogProps) {
  const { user } = useCurrentUser();
  const { mutate: createEvent, isPending } = useNostrPublish();
  const { toast } = useToast();

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<PollOption[]>([
    { id: generateOptionId(), label: '' },
    { id: generateOptionId(), label: '' }
  ]);
  const [pollType, setPollType] = useState<'singlechoice' | 'multiplechoice'>('singlechoice');
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [endTime, setEndTime] = useState('23:59');

  function generateOptionId(): string {
    return Math.random().toString(36).substring(2, 11);
  }

  const addOption = () => {
    if (options.length < 10) { // Limit to 10 options max
      setOptions(prev => [...prev, { id: generateOptionId(), label: '' }]);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) { // Keep minimum 2 options
      setOptions(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, label: string) => {
    setOptions(prev => prev.map((option, i) =>
      i === index ? { ...option, label } : option
    ));
  };

  const resetForm = () => {
    setQuestion('');
    setOptions([
      { id: generateOptionId(), label: '' },
      { id: generateOptionId(), label: '' }
    ]);
    setPollType('singlechoice');
    setEndDate(undefined);
    setEndTime('23:59');
  };

  const handleSubmit = () => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'You must be logged in to create a poll.',
        variant: 'destructive',
      });
      return;
    }

    if (!question.trim()) {
      toast({
        title: 'Question required',
        description: 'Please enter a question for your poll.',
        variant: 'destructive',
      });
      return;
    }

    const validOptions = options.filter(option => option.label.trim());
    if (validOptions.length < 2) {
      toast({
        title: 'Not enough options',
        description: 'Please provide at least 2 options for your poll.',
        variant: 'destructive',
      });
      return;
    }

    // Build tags for the poll event
    const tags: string[][] = [];

    // Add option tags
    validOptions.forEach(option => {
      tags.push(['option', option.id, option.label.trim()]);
    });

    // Add poll type
    tags.push(['polltype', pollType]);

    // Add end date if specified
    if (endDate) {
      const [hours, minutes] = endTime.split(':');
      const endDateTime = new Date(endDate);
      endDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      tags.push(['endsAt', Math.floor(endDateTime.getTime() / 1000).toString()]);
    }

    // Add client tag (this will be added automatically by useNostrPublish)

    // Create the poll event
    createEvent(
      {
        kind: 1068,
        content: question.trim(),
        tags,
      },
      {
        onSuccess: (pollEvent) => {
          // Generate nevent for the poll
          const nevent = nip19.neventEncode({
            id: pollEvent.id,
            kind: pollEvent.kind,
            author: pollEvent.pubkey,
            relays: []
          });

          // Pre-populate message content with poll reference (no prefix)
          const prePopulatedContent = `nostr:${nevent}`;

          toast({
            title: 'Poll created!',
            description: 'Your poll has been created successfully.',
          });
          resetForm();
          onOpenChange(false);
          onPollCreated?.(prePopulatedContent, 'poll', pollEvent);
        },
        onError: (error) => {
          console.error('Failed to create poll:', error);
          toast({
            title: 'Failed to create poll',
            description: 'There was an error creating your poll. Please try again.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>Create a Poll</DialogTitle>
          <DialogDescription>
            Create a poll to gather opinions from your community. Polls follow the NIP-88 standard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Poll Question */}
          <div className="space-y-2">
            <Label htmlFor="question">Poll Question *</Label>
            <Textarea
              id="question"
              placeholder="What would you like to ask?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Poll Options */}
          <div className="space-y-2">
            <Label>Poll Options *</Label>
            <div className="space-y-3">
              {options.map((option, index) => (
                <div key={option.id} className="flex items-center gap-2">
                  <Badge variant="outline" className="min-w-[60px] justify-center text-xs">
                    Option {index + 1}
                  </Badge>
                  <Input
                    placeholder={`Enter option ${index + 1}`}
                    value={option.label}
                    onChange={(e) => updateOption(index, e.target.value)}
                    className="flex-1"
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeOption(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 10 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOption}
                className="mt-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Option
              </Button>
            )}
          </div>

          {/* Poll Type */}
          <div className="space-y-3">
            <Label>Poll Type</Label>
            <RadioGroup value={pollType} onValueChange={(value: 'singlechoice' | 'multiplechoice') => setPollType(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="singlechoice" id="single" />
                <Label htmlFor="single" className="font-normal">
                  Single Choice - Voters can select only one option
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="multiplechoice" id="multi" />
                <Label htmlFor="multi" className="font-normal">
                  Multiple Choice - Voters can select multiple options
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* End Date (Optional) */}
          <div className="space-y-3">
            <Label>End Date (Optional)</Label>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[280px] justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>

              {endDate && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="endTime" className="text-sm">at</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-32"
                  />
                </div>
              )}

              {endDate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEndDate(undefined)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              If no end date is set, the poll will remain active indefinitely.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending ? 'Creating...' : 'Create Poll'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}