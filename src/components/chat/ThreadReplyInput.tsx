import { useState, useRef, KeyboardEvent } from "react";
import { Send, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmojiPickerComponent } from "@/components/ui/emoji-picker";
import { replaceShortcodes } from "@/lib/emoji";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { useQueryClient } from "@tanstack/react-query";
import type { NostrEvent } from "@nostrify/nostrify";

interface ThreadReplyInputProps {
  rootMessage: NostrEvent;
}

export function ThreadReplyInput({ rootMessage }: ThreadReplyInputProps) {
  const [reply, setReply] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { user } = useCurrentUser();
  const { mutateAsync: createEvent } = useNostrPublish();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    if (!user || !reply.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const tags = [
        // NIP-10 threading tags
        ["e", rootMessage.id, "", "root"], // Root event
        ["p", rootMessage.pubkey], // Root author
      ];

      // If this is a channel message, preserve channel context
      if (rootMessage.kind === 9411) {
        const channelTag = rootMessage.tags.find(([name]) => name === 't');
        const communityTag = rootMessage.tags.find(([name]) => name === 'a');

        if (channelTag) tags.push(["t", channelTag[1]]);
        if (communityTag) tags.push(["a", communityTag[1]]);
      }

      // Process shortcodes before sending
      const processedContent = replaceShortcodes(reply.trim());

      await createEvent({
        kind: rootMessage.kind === 9411 ? 9411 : 1, // Match the root message kind
        content: processedContent,
        tags,
      });

      // Clear the input
      setReply("");

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

  if (!user) {
    return (
      <div className="text-center text-gray-400 py-4">
        <p className="text-sm">You must be logged in to reply</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-700 rounded-lg p-3">
      <div className="flex items-end space-x-3">
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

          {reply.trim() && (
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
    </div>
  );
}