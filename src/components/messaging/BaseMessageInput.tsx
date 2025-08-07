import { KeyboardEvent, useRef, useState, useEffect, ClipboardEvent } from "react";
import { Plus, Send, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmojiPickerComponent } from "@/components/ui/emoji-picker";
import { EmojiAutocomplete } from "@/components/ui/emoji-autocomplete";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { extractShortcodeContext, searchEmojis, type EmojiData } from "@/lib/emojiUtils";
import { FileUploadDialog } from "@/components/chat/FileUploadDialog";
import { MediaAttachment } from "@/components/chat/MediaAttachment";
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
  const [showEmojiAutocomplete, setShowEmojiAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState("");
  const [selectedEmojiIndex, setSelectedEmojiIndex] = useState(0);
  const [shortcodeContext, setShortcodeContext] = useState<{
    query: string;
    startIndex: number;
    endIndex: number;
  } | null>(null);
  
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

  // Refocus textarea after sending a message
  useEffect(() => {
    if (!isSending && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isSending]);

  // Close autocomplete on blur
  const handleTextareaBlur = () => {
    // Small delay to allow emoji selection clicks to register
    setTimeout(() => {
      setShowEmojiAutocomplete(false);
      setShortcodeContext(null);
    }, 150);
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

    // The `onSendMessage` prop will handle the specifics of creating the event
    // (e.g., kind, specific tags for DMs vs. groups).
    await onSendMessage(message, []); // Passing empty tags for now
    setMessage("");
    setShowEmojiAutocomplete(false);
    setShortcodeContext(null);
    textareaRef.current?.focus();
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
    // If autocomplete is open, handle navigation keys here
    if (showEmojiAutocomplete) {
      const emojis = searchEmojis(autocompleteQuery, 8);
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedEmojiIndex((prev) => (prev + 1) % emojis.length);
          return;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedEmojiIndex((prev) => (prev - 1 + emojis.length) % emojis.length);
          return;
        case 'Enter':
          e.preventDefault();
          if (emojis[selectedEmojiIndex]) {
            handleEmojiAutocompleteSelect(emojis[selectedEmojiIndex]);
          }
          return;
        case 'Escape':
          e.preventDefault();
          setShowEmojiAutocomplete(false);
          setShortcodeContext(null);
          return;
      }
    }

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

  const handleEmojiAutocompleteSelect = (emoji: EmojiData) => {
    if (!shortcodeContext || !textareaRef.current) {
      return;
    }

    const textarea = textareaRef.current;
    
    // Save the context before clearing it
    const { startIndex, endIndex } = shortcodeContext;
    
    const newMessage = 
      message.slice(0, startIndex) + 
      emoji.emoji + 
      message.slice(endIndex);
    
    setMessage(newMessage);
    setShowEmojiAutocomplete(false);
    setShortcodeContext(null);

    // Position cursor after the inserted emoji
    setTimeout(() => {
      const newCursorPos = startIndex + emoji.emoji.length;
      textarea.selectionStart = textarea.selectionEnd = newCursorPos;
      textarea.focus();
    }, 0);
  };

  const updateAutocomplete = (newMessage: string, cursorPosition: number) => {
    const context = extractShortcodeContext(newMessage, cursorPosition);
    
    if (context && context.query.length > 0) {
      setShortcodeContext(context);
      setAutocompleteQuery(context.query);
      setSelectedEmojiIndex(0); // Reset selection on new query
      setShowEmojiAutocomplete(true);
    } else {
      setShowEmojiAutocomplete(false);
      setShortcodeContext(null);
      setSelectedEmojiIndex(0);
    }
  };

  const handleMessageChange = (newMessage: string) => {
    setMessage(newMessage);
    
    const textarea = textareaRef.current;
    if (!textarea) return;

    updateAutocomplete(newMessage, textarea.selectionStart);
  };

  const handleSelectionChange = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    updateAutocomplete(message, textarea.selectionStart);
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
  }

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

    <div className="relative p-3 bg-secondary rounded-lg w-full">
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
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onClick={handleSelectionChange}
          onBlur={handleTextareaBlur}
          onSelect={handleSelectionChange}
          onChange={(e) => {
            handleMessageChange(e.target.value)
            adjustTextareaHeight();
          }}
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
      
      {showEmojiAutocomplete && (
        <EmojiAutocomplete
          query={autocompleteQuery}
          selectedIndex={selectedEmojiIndex}
          onSelect={handleEmojiAutocompleteSelect}
          // onClose={() => setShowEmojiAutocomplete(false)}
        />
      )}

      {/* File Upload Dialog */}
      <FileUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onFilesUploaded={handleFilesUploaded}
      />
    </div>
  );
}
