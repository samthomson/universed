import { useState, useRef, KeyboardEvent } from "react";
import { Send, Smile, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmojiPickerComponent } from "@/components/ui/emoji-picker";
import { FileUploadDialog } from "./FileUploadDialog";
import { MediaAttachment } from "./MediaAttachment";
import { replaceShortcodes } from "@/lib/emoji";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { useQueryClient } from "@tanstack/react-query";
import type { NostrEvent } from "@nostrify/nostrify";

interface ThreadReplyInputProps {
  rootMessage: NostrEvent;
}

interface AttachedFile {
  url: string;
  mimeType: string;
  size: number;
  name: string;
  tags: string[][];
}

export function ThreadReplyInput({ rootMessage }: ThreadReplyInputProps) {
  const [reply, setReply] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { user } = useCurrentUser();
  const { mutateAsync: createEvent } = useNostrPublish();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    if (!user || (!reply.trim() && attachedFiles.length === 0) || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const tags = [
        // NIP-10 threading tags
        ["e", rootMessage.id, "", "root"], // Root event
        ["p", rootMessage.pubkey], // Root author
      ];

      // Thread replies should NOT include channel or community tags
      // This prevents them from appearing in the main channel feed
      // They are discovered through the e-tag reference to the root message

      // Add imeta tags for attached files
      attachedFiles.forEach(file => {
        const imetaTag = ["imeta"];
        imetaTag.push(`url ${file.url}`);
        if (file.mimeType) imetaTag.push(`m ${file.mimeType}`);
        if (file.size) imetaTag.push(`size ${file.size}`);
        if (file.name) imetaTag.push(`alt ${file.name}`);

        // Add any additional tags from the upload response
        file.tags.forEach(tag => {
          if (tag[0] === 'x') imetaTag.push(`x ${tag[1]}`); // hash
          if (tag[0] === 'ox') imetaTag.push(`ox ${tag[1]}`); // original hash
        });

        tags.push(imetaTag);
      });

      // Process shortcodes before sending
      let content = reply.trim();
      if (content) {
        content = replaceShortcodes(content);
      }

      // Add file URLs to content if there are attachments
      if (attachedFiles.length > 0) {
        const fileUrls = attachedFiles.map(file => file.url).join('\n');
        content = content ? `${content}\n\n${fileUrls}` : fileUrls;
      }

      await createEvent({
        kind: 1, // Thread replies are always kind 1 to ensure compatibility
        content,
        tags,
      });

      // Clear the input
      setReply("");
      setAttachedFiles([]);

      // Refresh thread replies
      queryClient.invalidateQueries({
        queryKey: ['thread-replies', rootMessage.id]
      });

    } catch (error) {
      console.error("Failed to send reply:", error);
      toast({
        title: "Error",
        description: "Failed to send reply. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newReply = reply.slice(0, start) + emoji + reply.slice(end);
      setReply(newReply);

      // Set cursor position after the emoji
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      }, 0);

      adjustTextareaHeight();
    }
  };

  const handleFilesUploaded = (files: AttachedFile[]) => {
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  if (!user) {
    return (
      <div className="text-center text-gray-400 py-4">
        <p className="text-sm">You must be logged in to reply</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-700 rounded-lg p-3">
      {/* Attached Files Preview */}
      {attachedFiles.length > 0 && (
        <div className="mb-3 space-y-2">
          <div className="text-xs text-gray-400">Attachments ({attachedFiles.length})</div>
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

      <div className="flex items-end space-x-3">
        {/* Attachment Button */}
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 text-gray-400 hover:text-gray-300 hover:bg-gray-800/60 flex-shrink-0"
          onClick={() => setShowUploadDialog(true)}
        >
          <Plus className="w-5 h-5" />
        </Button>

        {/* Reply Input */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={reply}
            onChange={(e) => {
              setReply(e.target.value);
              adjustTextareaHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Reply to thread..."
            className="min-h-[40px] max-h-[120px] resize-none bg-transparent border-0 focus-visible:ring-0 focus:bg-gray-800/30 text-gray-100 placeholder:text-gray-400 p-0 rounded transition-colors"
            disabled={isSubmitting}
          />
        </div>

        {/* Emoji Picker and Send Button */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          <EmojiPickerComponent
            onEmojiSelect={handleEmojiSelect}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-gray-400 hover:text-gray-300 hover:bg-gray-800/60"
              >
                <Smile className="w-5 h-5" />
              </Button>
            }
            side="top"
            align="end"
          />

          {(reply.trim() || attachedFiles.length > 0) && (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              size="icon"
              className="w-8 h-8 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Helper Text */}
      <div className="mt-1 text-xs text-gray-500">
        Press Enter to send, Shift+Enter for new line
      </div>

      {/* File Upload Dialog */}
      <FileUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onFilesUploaded={handleFilesUploaded}
      />
    </div>
  );
}