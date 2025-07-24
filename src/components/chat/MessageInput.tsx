import { useState, useRef, KeyboardEvent, useEffect } from "react";
import { Send, Plus, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmojiPickerComponent } from "@/components/ui/emoji-picker";
import { FileUploadDialog } from "./FileUploadDialog";
import { MediaAttachment } from "./MediaAttachment";
import { UserMentionAutocomplete } from "./UserMentionAutocomplete";
import { replaceShortcodes } from "@/lib/emoji";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { useTypingManager } from "@/hooks/useTypingIndicator";
import { useUserMentions } from "@/hooks/useUserMentions";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { NostrEvent } from "@nostrify/nostrify";

interface MessageInputProps {
  communityId: string;
  channelId: string;
  placeholder?: string;
}

interface AttachedFile {
  url: string;
  mimeType: string;
  size: number;
  name: string;
  tags: string[][];
}

export function MessageInput({ communityId, channelId, placeholder }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isMobile = useIsMobile();
  const { user } = useCurrentUser();
  const { mutateAsync: createEvent } = useNostrPublish();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { startTyping, stopTyping } = useTypingManager(channelId);

  // User mentions functionality
  const {
    currentMention,
    insertMention,
    updateMentions,
    getMentionTags,
    getFullTextWithPubkeys
  } = useUserMentions(message, setMessage, textareaRef);

  // Optimistic message sending mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, tags }: { content: string; tags: string[][] }) => {
      const event = await createEvent({
        kind: 9411,
        content,
        tags,
      });
      return event;
    },
    onMutate: async ({ content, tags }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['messages', communityId, channelId] });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData<NostrEvent[]>(['messages', communityId, channelId]);

      // Create optimistic message
      const optimisticMessage: NostrEvent = {
        id: `optimistic-${Date.now()}`,
        pubkey: user!.pubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 9411,
        tags,
        content,
        sig: '', // Will be filled by the actual event
      };

      // Optimistically update to the new value
      queryClient.setQueryData<NostrEvent[]>(['messages', communityId, channelId], old => {
        return [...(old || []), optimisticMessage];
      });

      // Return a context object with the snapshotted value
      return { previousMessages, optimisticMessage };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', communityId, channelId], context.previousMessages);
      }

      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data, variables, context) => {
      // Replace optimistic message with real one
      queryClient.setQueryData<NostrEvent[]>(['messages', communityId, channelId], old => {
        if (!old) return [data];
        return old.map(msg =>
          msg.id === context?.optimisticMessage.id ? data : msg
        );
      });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['messages', communityId, channelId] });
    },
  });

  const handleSubmit = async () => {
    if (!user || (!message.trim() && attachedFiles.length === 0) || sendMessageMutation.isPending) return;

    stopTyping();

    const [kind, pubkey, identifier] = communityId.split(':');

    if (!kind || !pubkey || !identifier) {
      toast({
        title: "Error",
        description: "Invalid community ID",
        variant: "destructive",
      });
      return;
    }

    const tags = [
      ["t", channelId],
      ["a", `${kind}:${pubkey}:${identifier}`],
    ];

    // Add p tags for user mentions
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

    // Process shortcodes and convert mentions to full format before sending
    let content = message.trim();
    if (content) {
      // Convert display mentions to full mentions with pubkeys
      content = getFullTextWithPubkeys(content);
      content = replaceShortcodes(content);
    }

    // Add file URLs to content if there are attachments
    if (attachedFiles.length > 0) {
      const fileUrls = attachedFiles.map(file => file.url).join('\n');
      content = content ? `${content}\n\n${fileUrls}` : fileUrls;
    }

    // Clear input immediately for better UX
    setMessage("");
    setAttachedFiles([]);

    // Send message with optimistic update
    sendMessageMutation.mutate({ content, tags });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle mention autocomplete navigation
    if (currentMention) {
      if (e.key === 'Escape') {
        e.preventDefault();
        updateMentions(message, textareaRef.current?.selectionStart || 0);
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'Enter', 'Tab'].includes(e.key)) {
        e.preventDefault();
        // These will be handled by the autocomplete component
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (value: string) => {
    setMessage(value);
    adjustTextareaHeight();

    // Update mentions based on cursor position
    const cursorPosition = textareaRef.current?.selectionStart || value.length;
    updateMentions(value, cursorPosition);

    if (value.trim() && !sendMessageMutation.isPending) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  const handleFilesUploaded = (files: AttachedFile[]) => {
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
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

  useEffect(() => {
    return () => {
      stopTyping();
    };
  }, [channelId, stopTyping]);

  return (
    <div className={`bg-gray-600 rounded-lg ${isMobile ? 'p-2' : 'p-3'}`}>
      {/* Attached Files Preview */}
      {attachedFiles.length > 0 && (
        <div className={`${isMobile ? 'mb-2' : 'mb-3'} space-y-2`}>
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
                className={isMobile ? "max-w-24" : "max-w-32"}
              />
            ))}
          </div>
        </div>
      )}

      <div className={`flex items-end ${isMobile ? 'space-x-2' : 'space-x-3'}`}>
        <Button
          variant="ghost"
          size="icon"
          className={`${isMobile ? 'w-9 h-9' : 'w-8 h-8'} text-gray-400 hover:text-gray-300 hover:bg-gray-800/60 flex-shrink-0 mobile-touch`}
          onClick={() => setShowUploadDialog(true)}
        >
          <Plus className={isMobile ? "w-6 h-6" : "w-5 h-5"} />
        </Button>

        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={stopTyping}
            onSelect={(e) => {
              // Update mentions when cursor position changes
              const target = e.target as HTMLTextAreaElement;
              updateMentions(message, target.selectionStart);
            }}
            placeholder={placeholder || "Type a message..."}
            className={`${isMobile ? 'min-h-[44px]' : 'min-h-[40px]'} max-h-[200px] resize-none bg-transparent border-0 focus-visible:ring-0 focus:bg-gray-800/30 text-gray-100 placeholder:text-gray-400 p-0 rounded transition-colors ${isMobile ? 'text-base' : ''} ${currentMention ? 'ring-2 ring-blue-500/50' : ''}`}
            disabled={sendMessageMutation.isPending}
          />

          {/* User Mention Autocomplete */}
          <UserMentionAutocomplete
            open={!!currentMention}
            onOpenChange={() => {
              // Close by updating mentions with current cursor position
              if (textareaRef.current) {
                updateMentions(message, textareaRef.current.selectionStart);
              }
            }}
            query={currentMention?.query || ''}
            onSelect={insertMention}
            communityId={communityId}
            triggerRef={textareaRef}
          />
        </div>

        <div className={`flex items-center ${isMobile ? 'space-x-1' : 'space-x-1'} flex-shrink-0`}>
          <EmojiPickerComponent
            onEmojiSelect={handleEmojiSelect}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className={`${isMobile ? 'w-9 h-9' : 'w-8 h-8'} text-gray-400 hover:text-gray-300 hover:bg-gray-800/60 mobile-touch`}
              >
                <Smile className={isMobile ? "w-6 h-6" : "w-5 h-5"} />
              </Button>
            }
            side="top"
            align="end"
          />

          {(message.trim() || attachedFiles.length > 0) && (
            <Button
              onClick={handleSubmit}
              disabled={sendMessageMutation.isPending}
              size="icon"
              className={`${isMobile ? 'w-9 h-9' : 'w-8 h-8'} bg-indigo-600 hover:bg-indigo-700 text-white mobile-touch`}
            >
              <Send className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
            </Button>
          )}
        </div>
      </div>

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