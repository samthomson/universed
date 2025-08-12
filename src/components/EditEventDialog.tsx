import { useState, useEffect, useRef } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useUploadFile } from '@/hooks/useUploadFile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CalendarIcon, Clock, MapPin, Image as ImageIcon, Globe, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import type { NostrEvent } from '@nostrify/nostrify';
import { getGroupedTimezoneOptions, getUserTimezone, createTimestampInTimezone } from '@/lib/eventTimezone';

interface EditEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: NostrEvent | null;
  communityId?: string;
}

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
}

function TimePicker({ value, onChange }: TimePickerProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

  const [hour, minute] = value.split(':') || ['00', '00'];

  const handleHourChange = (newHour: string) => {
    onChange(`${newHour}:${minute}`);
  };

  const handleMinuteChange = (newMinute: string) => {
    onChange(`${hour}:${newMinute}`);
  };

  return (
    <div className="flex items-center space-x-1">
      <Select value={hour} onValueChange={handleHourChange}>
        <SelectTrigger className="w-16">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {hours.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span>:</span>
      <Select value={minute} onValueChange={handleMinuteChange}>
        <SelectTrigger className="w-16">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {minutes.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function EditEventDialog({ open, onOpenChange, event, communityId }: EditEventDialogProps) {
  const { user } = useCurrentUser();
  const { mutate: createEvent } = useNostrPublish();
  const { mutateAsync: uploadFile } = useUploadFile();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnlineEvent, setIsOnlineEvent] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    imageUrl: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    categories: [] as string[],
    timezone: getUserTimezone(),
  });

  // Populate form when event changes
  useEffect(() => {
    if (event) {
      const getTag = (tagName: string) => 
        event.tags.find(tag => tag[0] === tagName)?.[1] || '';

      const title = getTag('title');
      const description = event.content || '';
      const location = getTag('location');
      const imageUrl = getTag('image');
      const startTime = getTag('start');
      const endTime = getTag('end');
      const startTzid = getTag('start_tzid') || getTag('end_tzid') || getUserTimezone();
      
      const categories = event.tags
        .filter(tag => tag[0] === 't')
        .map(tag => tag[1])
        .filter(category => category !== 'community-event');

      let startDate = '';
      let startTimeStr = '';
      let endDate = '';
      let endTimeStr = '';

      if (event.kind === 31922) {
        // Date-based event (YYYY-MM-DD format)
        startDate = startTime;
        endDate = endTime || startTime;
      } else if (event.kind === 31923) {
        // Time-based event (unix timestamp)
        if (startTime) {
          let timestamp = parseInt(startTime);
          if (timestamp < 10000000000) {
            timestamp = timestamp * 1000;
          }
          const date = new Date(timestamp);
          startDate = date.toISOString().split('T')[0];
          startTimeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        }

        if (endTime) {
          let timestamp = parseInt(endTime);
          if (timestamp < 10000000000) {
            timestamp = timestamp * 1000;
          }
          const date = new Date(timestamp);
          endDate = date.toISOString().split('T')[0];
          endTimeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        }
      }

      // Check if it's an online event
      const isOnline = location.includes(window.location.origin);
      setIsOnlineEvent(isOnline);

      setFormData({
        title,
        description,
        location,
        imageUrl,
        startDate,
        startTime: startTimeStr,
        endDate: endDate || startDate,
        endTime: endTimeStr,
        categories,
        timezone: startTzid,
      });
    }
  }, [event]);

  // Auto-fill online event location if toggled
  useEffect(() => {
    if (isOnlineEvent && communityId) {
      const onlineLocation = `${window.location.origin}/space/${communityId}`;
      setFormData(prev => ({
        ...prev,
        location: onlineLocation
      }));
    } else if (!isOnlineEvent && event) {
      // Reset to original location if not online
      const originalLocation = event.tags.find(tag => tag[0] === 'location')?.[1] || '';
      if (!originalLocation.includes(window.location.origin)) {
        setFormData(prev => ({
          ...prev,
          location: originalLocation
        }));
      }
    }
  }, [isOnlineEvent, communityId, event]);

  const handleImageUpload = async (file: File) => {
    if (!user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB');
      return;
    }

    setIsUploadingImage(true);
    setUploadProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const tags = await uploadFile(file);
      clearInterval(progressInterval);
      setUploadProgress(100);

      // Extract URL from upload tags
      const imageUrl = tags.find(tag => tag[0] === 'url')?.[1];
      if (imageUrl) {
        setFormData(prev => ({
          ...prev,
          imageUrl
        }));
        toast.success('Image uploaded successfully!');
      } else {
        throw new Error('No URL returned from upload');
      }
    } catch (error) {
      console.error('Failed to upload image:', error);
      toast.error('Failed to upload image');
    } finally {
      setIsUploadingImage(false);
      setUploadProgress(0);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const removeImage = () => {
    setFormData(prev => ({
      ...prev,
      imageUrl: ''
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !event) return;

    // Validate required fields
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (!formData.startDate) {
      toast.error('Start date is required');
      return;
    }

    if (!formData.endDate) {
      toast.error('End date is required');
      return;
    }

    // Validate end date is after start date
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    if (isBefore(end, start)) {
      toast.error('End date must be after start date');
      return;
    }

    setIsSubmitting(true);
    try {
      // Determine if this is a time-based event
      const hasTime = formData.startTime || formData.endTime;
      const eventKind = hasTime ? 31923 : 31922;

      // Format start and end timestamps
      let startTimestamp: string;
      let endTimestamp: string | undefined;

      if (hasTime) {
        // For time-based events, use Unix timestamps with proper timezone handling
        if (formData.startTime) {
          startTimestamp = createTimestampInTimezone(
            formData.startDate,
            formData.startTime,
            formData.timezone
          ).toString();
        } else {
          startTimestamp = Math.floor(
            new Date(formData.startDate + "T00:00:00").getTime() / 1000
          ).toString();
        }

        if (formData.endTime) {
          endTimestamp = createTimestampInTimezone(
            formData.endDate,
            formData.endTime,
            formData.timezone
          ).toString();
        } else {
          endTimestamp = Math.floor(
            new Date(formData.endDate + "T00:00:00").getTime() / 1000
          ).toString();
        }
      } else {
        // For date-only events, use YYYY-MM-DD format
        startTimestamp = formData.startDate;
        endTimestamp = formData.endDate;
      }

      // Get the original d tag value
      const dTag = event.tags.find(tag => tag[0] === 'd')?.[1];
      if (!dTag) {
        toast.error('Cannot edit event: missing identifier');
        return;
      }

      const tags = [
        ['d', dTag], // Keep the same d tag for replaceable events
        ['title', formData.title],
        ['location', formData.location],
      ];

      // Add start and end timestamps
      tags.push(['start', startTimestamp]);
      if (endTimestamp) {
        tags.push(['end', endTimestamp]);
      }

      // Add timezone tags only for time-based events
      if (hasTime) {
        tags.push(['start_tzid', formData.timezone]);
        if (endTimestamp) {
          tags.push(['end_tzid', formData.timezone]);
        }
      }

      // Add image URL if provided
      if (formData.imageUrl) {
        tags.push(['image', formData.imageUrl]);
      }

      // Add categories as 't' tags if provided
      if (formData.categories.length > 0) {
        for (const category of formData.categories) {
          tags.push(['t', category]);
        }
      }

      // Add community context if available
      if (communityId) {
        tags.push(['t', 'community-event']);
      }

      createEvent({
        kind: eventKind,
        content: formData.description,
        tags,
      }, {
        onSuccess: () => {
          toast.success('Event updated successfully!');
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error('Failed to update event');
          console.error('Error updating event:', error);
        }
      });
    } catch (error) {
      toast.error('Failed to update event');
      console.error('Error updating event:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user || !event) {
    return null;
  }

  // Only allow editing if user is the event author
  if (user.pubkey !== event.pubkey) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Edit Event
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Event Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter event title"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your event"
              rows={3}
            />
          </div>

          {/* Online Event Toggle */}
          {communityId && (
            <div className="flex items-center space-x-2">
              <Switch
                id="online-event"
                checked={isOnlineEvent}
                onCheckedChange={setIsOnlineEvent}
              />
              <Label htmlFor="online-event" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Online Event (held in community space)
              </Label>
            </div>
          )}

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location *
            </Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              placeholder={isOnlineEvent ? "Online event location will be set automatically" : "Enter event location"}
              disabled={isOnlineEvent}
              required
            />
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Event Image
            </Label>

            {/* Image Preview */}
            {formData.imageUrl && (
              <div className="relative group">
                <div className="aspect-video w-full overflow-hidden rounded-lg border">
                  <img
                    src={formData.imageUrl}
                    alt="Event preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={removeImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Upload Area */}
            {!formData.imageUrl && (
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                  isUploadingImage ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                )}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploadingImage ? (
                  <div className="space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                      <Upload className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Uploading image...</p>
                      <Progress value={uploadProgress} className="w-full" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Drop your image here or click to upload</p>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPG, GIF up to 10MB
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploadingImage}
            />

            {/* Manual URL input */}
            <div className="space-y-2">
              <Label htmlFor="imageUrl" className="text-sm text-muted-foreground">
                Or enter image URL manually:
              </Label>
              <Input
                id="imageUrl"
                value={formData.imageUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                placeholder="https://example.com/image.jpg"
                disabled={isUploadingImage}
              />
            </div>
          </div>

          {/* Date Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Calendar
                mode="single"
                selected={formData.startDate ? new Date(formData.startDate + 'T12:00:00Z') : undefined}
                onSelect={(date) => {
                  if (date) {
                    // Create date in UTC noon to avoid timezone issues
                    const selectedDate = new Date(
                      Date.UTC(
                        date.getFullYear(),
                        date.getMonth(),
                        date.getDate(),
                        12,
                        0,
                        0,
                        0
                      )
                    );
                    setFormData(prev => ({
                      ...prev,
                      startDate: selectedDate.toISOString().split('T')[0]
                    }));
                  }
                }}
                disabled={(date) => isBefore(date, startOfDay(new Date()))}
                className="rounded-md border"
              />
            </div>

            <div className="space-y-2">
              <Label>End Date *</Label>
              <Calendar
                mode="single"
                selected={formData.endDate ? new Date(formData.endDate + 'T12:00:00Z') : undefined}
                onSelect={(date) => {
                  if (date) {
                    // Create date in UTC noon to avoid timezone issues
                    const selectedDate = new Date(
                      Date.UTC(
                        date.getFullYear(),
                        date.getMonth(),
                        date.getDate(),
                        12,
                        0,
                        0,
                        0
                      )
                    );
                    setFormData(prev => ({
                      ...prev,
                      endDate: selectedDate.toISOString().split('T')[0]
                    }));
                  }
                }}
                disabled={(date) => {
                  const startDate = formData.startDate ? new Date(formData.startDate + 'T12:00:00Z') : new Date();
                  startDate.setUTCHours(0, 0, 0, 0);
                  return isBefore(date, startDate);
                }}
                className="rounded-md border"
              />
            </div>
          </div>

          {/* Time Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Start Time (Optional)
              </Label>
              <TimePicker
                value={formData.startTime}
                onChange={(value) => setFormData(prev => ({ ...prev, startTime: value }))}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                End Time (Optional)
              </Label>
              <TimePicker
                value={formData.endTime}
                onChange={(value) => setFormData(prev => ({ ...prev, endTime: value }))}
              />
            </div>
          </div>

          {/* Timezone (only show if times are set) */}
          {(formData.startTime || formData.endTime) && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Timezone
              </Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) => setFormData(prev => ({ ...prev, timezone: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px] overflow-y-auto scrollbar-thin">
                  {getGroupedTimezoneOptions().map((group) => (
                    <div key={group.group}>
                      <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                        {group.group}
                      </div>
                      {group.options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Event'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}