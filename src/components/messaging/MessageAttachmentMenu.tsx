import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Image, BarChart3 } from 'lucide-react';
import { FileUploadDialog } from '@/components/chat/FileUploadDialog';
import { PollCreationDialog } from '@/components/PollCreationDialog';

interface AttachedFile {
  url: string;
  mimeType: string;
  size: number;
  name: string;
  tags: string[][];
}

interface MessageAttachmentMenuProps {
  onFilesUploaded: (files: AttachedFile[]) => void;
  onPollCreated?: () => void;
  communityId?: string;
  channelId?: string;
}

export function MessageAttachmentMenu({ onFilesUploaded, onPollCreated, communityId, channelId }: MessageAttachmentMenuProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showPollDialog, setShowPollDialog] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleFileUpload = () => {
    setIsMenuOpen(false);
    setShowUploadDialog(true);
  };

  const handlePollCreation = () => {
    setIsMenuOpen(false);
    setShowPollDialog(true);
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
        onPollCreated={onPollCreated}
        communityId={communityId}
        channelId={channelId}
      />
    </>
  );
}