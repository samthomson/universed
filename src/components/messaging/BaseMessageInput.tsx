import { KeyboardEvent, useRef, useState, useEffect, ClipboardEvent } from "react";
import { Send, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmojiPickerComponent } from "@/components/ui/emoji-picker";
import { MediaAttachment } from "@/components/chat/MediaAttachment";
import { MessageAttachmentMenu } from "@/components/messaging/MessageAttachmentMenu";
import { EmojiAutocomplete } from "@/components/ui/emoji-autocomplete";
import { UserMentionAutocomplete } from "@/components/chat/UserMentionAutocomplete";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { extractShortcodeContext, searchEmojis, type EmojiData } from "@/lib/emojiUtils";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useUserMentions } from "@/hooks/useUserMentions";
import { replaceShortcodes } from "@/lib/emoji";
import type { NostrEvent } from "@/types/nostr";
import { MembershipCTA } from "@/components/community/MembershipCTA";

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
  communityId?: string;
  channelId?: string;
  membershipStatus?: 'owner' | 'moderator' | 'approved' | 'pending' | 'declined' | 'banned' | 'not-member';
  onJoinRequest?: () => void;
  // Thread context props
  rootMessage?: NostrEvent;
  threadReplies?: NostrEvent[];
}

export function BaseMessageInput({
  onSendMessage,
  config,
  placeholder,
  isSending,
  disabled,
  disabledReason,
  communityId,
  channelId,
  membershipStatus,
  onJoinRequest,
  rootMessage,
  threadReplies,
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

  // User mentions state
  const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(-1); // Start with no selection
  const [isInsertingMention, setIsInsertingMention] = useState(false); // Flag to prevent reopening autocomplete after insertion

  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { mutateAsync: uploadFile } = useUploadFile();

  // User mentions functionality
  const {
    insertMention,
    updateMentions,
    getMentionTags,
    getFullTextWithPubkeys
  } = useUserMentions(message, setMessage, textareaRef);

  // Enter key handler for mentions
  const [mentionEnterHandler, setMentionEnterHandler] = useState<(() => boolean) | null>(null);

  const handleMentionEnterKey = (handler: () => boolean) => {
    setMentionEnterHandler(handler);
  };



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
      // Limit height to approximately 2 lines (64px)
      const maxHeight = 64;
      textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
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
    setIsFocused(false)
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

    // Store original values in case we need to restore on error
    const originalMessage = message.trim();
    const originalFiles = [...attachedFiles];

    try {
      const tags: string[][] = [];

      // Add mention tags (p tags for mentioned users)
      const mentionTags = getMentionTags();
      tags.push(...mentionTags);

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

      // Process shortcodes and mentions before sending
      let content = originalMessage;
      if (content) {
        content = replaceShortcodes(content);
        // Convert display mentions to full mentions with pubkeys
        content = getFullTextWithPubkeys(content);
      }

      // Add file URLs to content if there are attachments
      if (attachedFiles.length > 0) {
        const fileUrls = attachedFiles.map(file => file.url).join('\n');
        content = content ? `${content}\n\n${fileUrls}` : fileUrls;
      }

      // Clear form immediately for responsive UX
      setMessage("");
      setAttachedFiles([]);
      setShowEmojiAutocomplete(false);
      setShortcodeContext(null);
      setShowMentionAutocomplete(false);
      setMentionQuery("");
      textareaRef.current?.focus();

      // Send the message in the background
      await onSendMessage(content, tags);
    } catch (error) {
      console.error("Failed to send message:", error);

      // Restore form state on error
      setMessage(originalMessage);
      setAttachedFiles(originalFiles);
      // Re-mention state will be restored by the useEffect when message changes
      textareaRef.current?.focus();

      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // If mention autocomplete is open, handle special keys
    if (showMentionAutocomplete) {
      switch (e.key) {
        case 'Enter':
        case 'Tab':
          // Only call the handler if it exists and there are actual results to select from
          if (mentionEnterHandler && mentionEnterHandler()) {
            e.preventDefault();
            return;
          }
          // For Tab key, always prevent default when autocomplete is open
          if (e.key === 'Tab' && showMentionAutocomplete) {
            e.preventDefault();
            return;
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowMentionAutocomplete(false);
          setMentionQuery("");
          return;
      }
    }

    // If emoji autocomplete is open, handle navigation keys here
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

  const handleMentionSelect = (pubkey: string, displayName: string) => {
    setIsInsertingMention(true);
    insertMention(pubkey, displayName);
    setShowMentionAutocomplete(false);
    setMentionQuery("");

    // Reset the flag after a short delay to allow the text update to complete
    setTimeout(() => {
      setIsInsertingMention(false);
    }, 50);
  };

  // Wrapper function to handle the type difference
  const handleMentionKeyDown = (e: KeyboardEvent<Element>) => {
    // Convert to React.KeyboardEvent for compatibility
    const reactEvent = e as unknown as KeyboardEvent<HTMLTextAreaElement>;
    handleKeyDown(reactEvent);
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

    // Update emoji autocomplete
    updateAutocomplete(newMessage, textarea.selectionStart);

    // Update mention autocomplete - this will update currentMention state
    updateMentions(newMessage, textarea.selectionStart);

    // Don't reopen autocomplete if we're in the middle of inserting a mention
    if (isInsertingMention) {
      return;
    }

    // Check if we should show mention autocomplete by looking at the text directly
    const textBeforeCursor = newMessage.slice(0, textarea.selectionStart);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      // Check if this @ is not part of an existing mention
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      const spaceIndex = textAfterAt.indexOf(' ');
      const newlineIndex = textAfterAt.indexOf('\n');

      // If there's no space or newline after @, or cursor is before them, show autocomplete
      if ((spaceIndex === -1 || textarea.selectionStart <= lastAtIndex + 1 + spaceIndex) &&
          (newlineIndex === -1 || textarea.selectionStart <= lastAtIndex + 1 + newlineIndex)) {
        setShowMentionAutocomplete(true);
        const query = newMessage.slice(lastAtIndex + 1, textarea.selectionStart);
        setMentionQuery(query);
        setSelectedMentionIndex(-1); // Start with no selection
      } else {
        setShowMentionAutocomplete(false);
        setMentionQuery("");
      }
    } else {
      setShowMentionAutocomplete(false);
      setMentionQuery("");
    }
  };

  const handleSelectionChange = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    updateAutocomplete(message, textarea.selectionStart);

    // Update mention autocomplete on selection change
    updateMentions(message, textarea.selectionStart);

    // Don't reopen autocomplete if we're in the middle of inserting a mention
    if (isInsertingMention) {
      return;
    }

    // Check if we should show mention autocomplete by looking at the text directly
    const textBeforeCursor = message.slice(0, textarea.selectionStart);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      // Check if this @ is not part of an existing mention
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      const spaceIndex = textAfterAt.indexOf(' ');
      const newlineIndex = textAfterAt.indexOf('\n');

      // If there's no space or newline after @, or cursor is before them, show autocomplete
      if ((spaceIndex === -1 || textarea.selectionStart <= lastAtIndex + 1 + spaceIndex) &&
          (newlineIndex === -1 || textarea.selectionStart <= lastAtIndex + 1 + newlineIndex)) {
        setShowMentionAutocomplete(true);
        const query = message.slice(lastAtIndex + 1, textarea.selectionStart);
        setMentionQuery(query);
        setSelectedMentionIndex(-1); // Start with no selection
      } else {
        setShowMentionAutocomplete(false);
        setMentionQuery("");
      }
    } else {
      setShowMentionAutocomplete(false);
      setMentionQuery("");
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
  }

  // Check if user is not an approved member and show CTA instead of message input
  if (membershipStatus && !['owner', 'moderator', 'approved'].includes(membershipStatus)) {
    return (
      <MembershipCTA
        _communityId={communityId || ''}
        onJoinRequest={onJoinRequest || (() => {})}
        className="m-4"
      />
    );
  }

  if (disabled) {
    return (
      <div className="p-4 bg-gray-100 dark:bg-gray-800 border border-purple-200 dark:border-purple-800 backdrop-blur-sm rounded-2xl opacity-60">
        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          {disabledReason || "Messaging is disabled."}
        </p>
      </div>
    );
  }

  return (
    <div className={`relative p-4 bg-gray-100 dark:bg-gray-800 border border-purple-200 dark:border-purple-800 backdrop-blur-sm rounded-2xl w-full transition-all duration-200 ${
      isFocused ? 'border-purple-400 dark:border-purple-600' : 'border-purple-200 dark:border-purple-800'
    }`}>
      {/* Attached Files Preview */}
      {attachedFiles.length > 0 && (
        <div className="mb-4 space-y-3">
          <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">Attachments ({attachedFiles.length})</div>
          <div className="flex flex-wrap gap-3">
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

      <div className="flex items-center space-x-3">
        {config.allowFileUpload && (
          <MessageAttachmentMenu
            onFilesUploaded={handleFilesUploaded}
            communityId={communityId}
            channelId={channelId}
          />
        )}
        <textarea
          ref={textareaRef}
          value={message}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onClick={handleSelectionChange}
          onBlur={handleTextareaBlur}

          onFocus={() => setIsFocused(true)}
          onSelect={handleSelectionChange}
          onChange={(e) => {
            handleMessageChange(e.target.value)
            adjustTextareaHeight();
          }}
          placeholder={placeholder || "Type a message..."}
          className="min-h-[24px] max-h-[64px] w-full resize-none bg-transparent border-none
          focus:outline-none focus:ring-0 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-500
          p-0 leading-tight scrollbar-thin overflow-y-auto"
          disabled={isSending}
          rows={1}
        />
        {config.allowEmoji && (
          <EmojiPickerComponent
            onEmojiSelect={handleEmojiSelect}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-purple-100 dark:hover:bg-purple-900/20 rounded-full"
              >
                <Smile className="w-4 h-4" />
              </Button>
            }
          />
        )}
        <Button
          onClick={handleSubmit}
          disabled={isSending || (!message.trim() && attachedFiles.length === 0)}
          size="icon"
          className="w-8 h-8 bg-purple-600 hover:bg-purple-700 text-white rounded-full"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {showMentionAutocomplete && config.allowMentions && (
        <UserMentionAutocomplete
          open={showMentionAutocomplete}
          onOpenChange={setShowMentionAutocomplete}
          query={mentionQuery}
          onSelect={handleMentionSelect}
          communityId={communityId}
          triggerRef={textareaRef}
          onKeyDown={handleMentionKeyDown}
          selectedIndex={selectedMentionIndex}
          onSelectedIndexChange={setSelectedMentionIndex}
          onEnterKey={handleMentionEnterKey}
          rootMessage={rootMessage}
          threadReplies={threadReplies}
        />
      )}

      {showEmojiAutocomplete && (
        <EmojiAutocomplete
          query={autocompleteQuery}
          selectedIndex={selectedEmojiIndex}
          onSelect={handleEmojiAutocompleteSelect}
        />
      )}

    </div>
  );
}
