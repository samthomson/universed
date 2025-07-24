import { useState, useRef, KeyboardEvent } from "react";
import { Send, Plus, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmojiPickerComponent } from "@/components/ui/emoji-picker";
import { FileUploadDialog } from "@/components/chat/FileUploadDialog";
import { MediaAttachment } from "@/components/chat/MediaAttachment";
import { replaceShortcodes } from "@/lib/emoji";
import { useSendDM } from "@/hooks/useSendDM";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import type { NostrEvent } from "@nostrify/nostrify";

interface DMMessageInputProps {
  conversationId: string; // The other person's pubkey
}

interface AttachedFile {
  url: string;
  mimeType: string;
  size: number;
  name: string;
  tags: string[][];
}

export function DMMessageInput({ conversationId }: DMMessageInputProps) {
  const [message, setMessage] = useState("");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { user } = useCurrentUser();
  const { mutateAsync: sendDM } = useSendDM();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Optimistic DM sending mutation
  const sendDMMutation = useMutation({
    mutationFn: async ({ content, attachments }: { content: string; attachments: AttachedFile[] }) => {
      return await sendDM({
        recipientPubkey: conversationId,
        content,
        attachments,
      });
    },
    onMutate: async ({ content }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['dm-messages', conversationId] });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData<NostrEvent[]>(['dm-messages', conversationId]);

      // Create optimistic message
      const optimisticMessage: NostrEvent = {
        id: `optimistic-dm-${Date.now()}`,
        pubkey: user!.pubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1059, // Encrypted DM kind
        tags: [['p', conversationId]],
        content: content, // This would be encrypted in reality
        sig: '',
      };

      // Optimistically update to the new value
      queryClient.setQueryData<NostrEvent[]>(['dm-messages', conversationId], old => {
        return [...(old || []), optimisticMessage];
      });

      // Return a context object with the snapshotted value
      return { previousMessages, optimisticMessage };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousMessages) {
        queryClient.setQueryData(['dm-messages', conversationId], context.previousMessages);
      }

      console.error("Failed to send DM:", err);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data, variables, context) => {
      // Replace optimistic message with real one
      if (context?.optimisticMessage) {
        queryClient.setQueryData<NostrEvent[]>(['dm-messages', conversationId], old => {
          if (!old) return [data];
          return old.map(msg =>
            msg.id === context.optimisticMessage.id ? data : msg
          );
        });
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['dm-messages', conversationId] });
    },
  });

  const handleSubmit = async () => {
    if (!user || (!message.trim() && attachedFiles.length === 0) || sendDMMutation.isPending) return;

    // Process shortcodes before sending
    let processedContent = message.trim();
    if (processedContent) {
      processedContent = replaceShortcodes(processedContent);
    }

    // Clear the input immediately for better UX
    setMessage("");
    setAttachedFiles([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Send DM with optimistic update
    sendDMMutation.mutate({ content: processedContent, attachments: attachedFiles });
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

  const handleFilesUploaded = (files: AttachedFile[]) => {
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  if (!user) {
    return (
      <div className="text-center text-gray-400 py-4">
        <p className="text-sm">You must be logged in to send messages</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-600 rounded-lg p-3">
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

        {/* Message Input */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              adjustTextareaHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="min-h-[40px] max-h-[200px] resize-none bg-transparent border-0 focus-visible:ring-0 focus:bg-gray-800/30 text-gray-100 placeholder:text-gray-400 p-0 rounded transition-colors"
            disabled={sendDMMutation.isPending}
          />
        </div>

        {/* Action Buttons */}
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

          {(message.trim() || attachedFiles.length > 0) && (
            <Button
              onClick={handleSubmit}
              disabled={sendDMMutation.isPending}
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