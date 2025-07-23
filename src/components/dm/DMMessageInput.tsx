import { useState, useRef, KeyboardEvent } from "react";
import { Send, Plus, Smile, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmojiPickerComponent } from "@/components/ui/emoji-picker";
import { replaceShortcodes } from "@/lib/emoji";
import { useSendDM } from "@/hooks/useSendDM";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";

interface DMMessageInputProps {
  conversationId: string; // The other person's pubkey
}

export function DMMessageInput({ conversationId }: DMMessageInputProps) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { user } = useCurrentUser();
  const { mutateAsync: sendDM } = useSendDM();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!user || !message.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Process shortcodes before sending
      const processedContent = replaceShortcodes(message.trim());

      await sendDM({
        recipientPubkey: conversationId,
        content: processedContent,
      });

      // Clear the input
      setMessage("");

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

    } catch (error) {
      console.error("Failed to send DM:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
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

  if (!user) {
    return (
      <div className="text-center text-gray-400 py-4">
        <p className="text-sm">You must be logged in to send messages</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-600 rounded-lg p-3">
      <div className="flex items-end space-x-3">
        {/* Attachment Button */}
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 text-gray-400 hover:text-gray-300 hover:bg-gray-800/60 flex-shrink-0"
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
            disabled={isSubmitting}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-gray-400 hover:text-gray-300 hover:bg-gray-800/60"
          >
            <Gift className="w-5 h-5" />
          </Button>

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

          {message.trim() && (
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