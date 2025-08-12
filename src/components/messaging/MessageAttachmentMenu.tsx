import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Image, BarChart3, CalendarIcon } from 'lucide-react';
import { FileUploadDialog } from '@/components/chat/FileUploadDialog';
import { PollCreationDialog } from '@/components/PollCreationDialog';
import { CreateEventDialog } from '@/components/CreateEventDialog';
import type { NostrEvent } from '@nostrify/nostrify';

interface AttachedFile {
  url: string;
  mimeType: string;
  size: number;
  name: string;
  tags: string[][];
}

interface MessageAttachmentMenuProps {
  onFilesUploaded: (files: AttachedFile[]) => void;
  onPrePopulatedContent?: (content: string, eventType: 'poll' | 'event', eventData?: NostrEvent) => void;
  communityId?: string;
  channelId?: string;
}

export function MessageAttachmentMenu({ onFilesUploaded, onPrePopulatedContent, communityId, channelId }: MessageAttachmentMenuProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showPollDialog, setShowPollDialog] = useState(false);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleFileUpload = () => {
    setIsMenuOpen(false);
    setShowUploadDialog(true);
  };

  const handlePollCreation = () => {
    setIsMenuOpen(false);
    setShowPollDialog(true);
  };

  const handleEventCreation = () => {
    setIsMenuOpen(false);
    setShowEventDialog(true);
  };

  return (
    <>
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-muted-foreground hover:text-foreground flex items-center justify-center"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={handleFileUpload} className="cursor-pointer">
            <Image className="w-4 h-4 mr-2" />
            Upload File
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handlePollCreation} className="cursor-pointer">
            <BarChart3 className="w-4 h-4 mr-2" />
            Create Poll
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleEventCreation} className="cursor-pointer">
            <CalendarIcon className="w-4 h-4 mr-2" />
            Create Event
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* File Upload Dialog */}
      <FileUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onFilesUploaded={onFilesUploaded}
      />

      {/* Poll Creation Dialog */}
      <PollCreationDialog
        open={showPollDialog}
        onOpenChange={setShowPollDialog}
        onPollCreated={(content, eventType, eventData) => onPrePopulatedContent?.(content, eventType, eventData)}
        communityId={communityId}
        channelId={channelId}
      />

      {/* Event Creation Dialog */}
      <CreateEventDialog
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
        onEventCreated={(content, eventType, eventData) => onPrePopulatedContent?.(content, eventType, eventData)}
        communityId={communityId}
        channelId={channelId}
      />
    </>
  );
}