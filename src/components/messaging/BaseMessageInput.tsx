import { KeyboardEvent, useRef, useState, ClipboardEvent } from "react";
import { Plus, Send, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmojiPickerComponent } from "@/components/ui/emoji-picker";
import { FileUploadDialog } from "@/components/chat/FileUploadDialog";
import { MediaAttachment } from "@/components/chat/MediaAttachment";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { useUploadFile } from "@/hooks/useUploadFile";
import { replaceShortcodes } from "@/lib/emoji";
import type { NostrEvent } from "@/types/nostr";

interface MessageInputConfig {
  allowMentions: boolean;
  allowFileUpload: boolean;
  allowEmoji: boolean;
}

interface BaseMessageInputProps {
  onSendMessage: (
    content: string,
    tags: string[][],
  ) => Promise<NostrEvent | void>;
  config: MessageInputConfig;
  placeholder?: string;
  isSending: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export function BaseMessageInput({
  onSendMessage,
  config,
  placeholder,
  isSending,
  disabled,
  disabledReason,
}: BaseMessageInputProps) {
  const [message, setMessage] = useState("");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { mutateAsync: uploadFile } = useUploadFile();

  interface AttachedFile {
    url: string;
    mimeType: string;
    size: number;
    name: string;
    tags: string[][];
  }

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  };

  const handleSubmit = async () => {
    if (!user || (!message.trim() && attachedFiles.length === 0) || isSending) return;

    if (disabled) {
      toast({
        title: "Cannot send message",
        description: disabledReason ||
          "You don't have permission to send messages.",
        variant: "destructive",
      });
      return;
    }

    try {
      const tags: string[][] = [];

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
      let content = message.trim();
      if (content) {
        content = replaceShortcodes(content);
      }

      // Add file URLs to content if there are attachments
      if (attachedFiles.length > 0) {
        const fileUrls = attachedFiles.map(file => file.url).join('\n');
        content = content ? `${content}\n\n${fileUrls}` : fileUrls;
      }

      await onSendMessage(content, tags);
      setMessage("");
      setAttachedFiles([]);
    } catch (error) {
      console.error("Failed to send message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newMessage = message.slice(0, start) + emoji + message.slice(end);
      setMessage(newMessage);

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

  const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));

    if (imageItems.length > 0) {
      e.preventDefault(); // Prevent default paste behavior for images

      const files = await Promise.all(
        imageItems.map(item => new Promise<File | null>((resolve) => {
          const file = item.getAsFile();
          resolve(file);
        }))
      );

      const validFiles = files.filter((file): file is File => file !== null);

      if (validFiles.length > 0) {
        try {
          // Upload each image file
          for (const file of validFiles) {
            const tags = await uploadFile(file);
            
            // Extract URL from tags (first tag should contain the URL)
            const url = tags[0]?.[1];
            if (!url) {
              throw new Error('No URL returned from upload');
            }

            const attachedFile: AttachedFile = {
              url,
              mimeType: file.type,
              size: file.size,
              name: file.name || `pasted-image-${Date.now()}`,
              tags,
            };

            setAttachedFiles(prev => [...prev, attachedFile]);
          }

          toast({
            title: 'Image uploaded',
            description: `${validFiles.length} image${validFiles.length > 1 ? 's' : ''} uploaded successfully.`,
          });
        } catch (error) {
          console.error('Paste upload failed:', error);
          toast({
            title: 'Upload failed',
            description: 'Failed to upload pasted image. Please try again.',
            variant: 'destructive',
          });
        }
      }
    }
    // If no images, let the default paste behavior handle text
  };

  if (disabled) {
    return (
      <div className="p-3 bg-secondary rounded-lg opacity-60">
        <p className="text-center text-sm text-muted-foreground">
          {disabledReason || "Messaging is disabled."}
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 bg-secondary rounded-lg w-full">
      {/* Attached Files Preview */}
      {attachedFiles.length > 0 && (
        <div className="mb-3 space-y-2">
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

      <div className="flex items-end space-x-3">
        {config.allowFileUpload && (
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-muted-foreground hover:text-foreground"
            onClick={() => setShowUploadDialog(true)}
          >
            <Plus className="w-5 h-5" />
          </Button>
        )}
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            adjustTextareaHeight();
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder || "Type a message..."}
          className="min-h-[40px] max-h-[200px] resize-none bg-transparent border-0 focus-visible:ring-0 text-foreground placeholder:text-muted-foreground p-0"
          disabled={isSending}
        />
        {config.allowEmoji && (
          <EmojiPickerComponent
            onEmojiSelect={handleEmojiSelect}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-muted-foreground hover:text-foreground"
              >
                <Smile className="w-5 h-5" />
              </Button>
            }
          />
        )}
        <Button
          onClick={handleSubmit}
          disabled={isSending || (!message.trim() && attachedFiles.length === 0)}
          size="icon"
          className="w-8 h-8 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Send className="w-4 h-4" />
        </Button>
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
