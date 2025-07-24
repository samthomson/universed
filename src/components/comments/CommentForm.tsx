import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { FileUploadDialog } from '@/components/chat/FileUploadDialog';
import { MediaAttachment } from '@/components/chat/MediaAttachment';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePostComment } from '@/hooks/usePostComment';
import { LoginArea } from '@/components/auth/LoginArea';
import { NostrEvent } from '@nostrify/nostrify';
import { MessageSquare, Send, Plus } from 'lucide-react';


interface CommentFormProps {
  root: NostrEvent | URL;
  reply?: NostrEvent | URL;
  onSuccess?: () => void;
  placeholder?: string;
  compact?: boolean;
}

interface AttachedFile {
  url: string;
  mimeType: string;
  size: number;
  name: string;
  tags: string[][];
}

export function CommentForm({
  root,
  reply,
  onSuccess,
  placeholder = "Write a comment...",
  compact = false
}: CommentFormProps) {
  const [content, setContent] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const { user } = useCurrentUser();
  const { mutate: postComment, isPending } = usePostComment();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if ((!content.trim() && attachedFiles.length === 0) || !user) return;

    postComment(
      {
        content: content.trim(),
        root,
        reply,
        attachments: attachedFiles
      },
      {
        onSuccess: () => {
          setContent('');
          setAttachedFiles([]);
          onSuccess?.();
        },
      }
    );
  };

  const handleFilesUploaded = (files: AttachedFile[]) => {
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  if (!user) {
    return (
      <Card className={compact ? "border-dashed" : ""}>
        <CardContent className={compact ? "p-4" : "p-6"}>
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-2 text-muted-foreground">
              <MessageSquare className="h-5 w-5" />
              <span>Sign in to {reply ? 'reply' : 'comment'}</span>
            </div>
            <LoginArea />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={compact ? "border-dashed" : ""}>
      <CardContent className={compact ? "p-4" : "p-6"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Attached Files Preview */}
          {attachedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Attachments ({attachedFiles.length})</div>
              <div className="flex flex-wrap gap-2">
                {attachedFiles.map((file, index) => (
                  <MediaAttachment
                    key={index}
                    url={file.url}
                    mimeType={file.mimeType}
                    size={file.size}
                    name={file.name}
                    showRemove
                    onRemove={() => removeAttachedFile(index)}
                    className="max-w-32"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex space-x-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="flex-shrink-0"
              onClick={() => setShowUploadDialog(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={placeholder}
              className={compact ? "min-h-[80px]" : "min-h-[100px]"}
              disabled={isPending}
            />
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {reply ? 'Replying to comment' : 'Adding to the discussion'}
            </span>
            <Button
              type="submit"
              disabled={(!content.trim() && attachedFiles.length === 0) || isPending}
              size={compact ? "sm" : "default"}
            >
              <Send className="h-4 w-4 mr-2" />
              {isPending ? 'Posting...' : (reply ? 'Reply' : 'Comment')}
            </Button>
          </div>
        </form>

        {/* File Upload Dialog */}
        <FileUploadDialog
          open={showUploadDialog}
          onOpenChange={setShowUploadDialog}
          onFilesUploaded={handleFilesUploaded}
        />
      </CardContent>
    </Card>
  );
}