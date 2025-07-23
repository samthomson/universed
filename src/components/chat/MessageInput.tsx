import { useState, useRef, KeyboardEvent, useEffect } from "react";
import { Send, Plus, Smile, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { useTypingManager } from "@/hooks/useTypingIndicator";
import { useQueryClient } from "@tanstack/react-query";

interface MessageInputProps {
  communityId: string;
  channelId: string;
  placeholder?: string;
}

export function MessageInput({ communityId, channelId, placeholder }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { user } = useCurrentUser();
  const { mutateAsync: createEvent } = useNostrPublish();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { startTyping, stopTyping } = useTypingManager(channelId);

  const handleSubmit = async () => {
    if (!user || !message.trim() || isSubmitting) return;

    setIsSubmitting(true);
    stopTyping();

    try {
      const [kind, pubkey, identifier] = communityId.split(':');

      if (!kind || !pubkey || !identifier) {
        throw new Error('Invalid community ID');
      }

      const tags = [
        ["t", channelId],
        ["a", `${kind}:${pubkey}:${identifier}`],
      ];

      await createEvent({
        kind: 9411,
        content: message.trim(),
        tags,
      });

      setMessage("");

      queryClient.invalidateQueries({
        queryKey: ['messages', communityId, channelId]
      });

    } catch (error) {
      console.error("Failed to send message:", error);
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

  const handleInputChange = (value: string) => {
    setMessage(value);
    adjustTextareaHeight();
    
    if (value.trim() && !isSubmitting) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  };

  useEffect(() => {
    return () => {
      stopTyping();
    };
  }, [channelId, stopTyping]);

  return (
    <div className="bg-gray-600 rounded-lg p-3">
      <div className="flex items-end space-x-3">
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 text-gray-400 hover:text-gray-300 flex-shrink-0"
        >
          <Plus className="w-5 h-5" />
        </Button>

        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={stopTyping}
            placeholder={placeholder || "Type a message..."}
            className="min-h-[40px] max-h-[200px] resize-none bg-transparent border-0 focus-visible:ring-0 text-gray-100 placeholder:text-gray-400 p-0"
            disabled={isSubmitting}
          />
        </div>

        <div className="flex items-center space-x-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-gray-400 hover:text-gray-300"
          >
            <Gift className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-gray-400 hover:text-gray-300"
          >
            <Smile className="w-5 h-5" />
          </Button>

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

      <div className="mt-1 text-xs text-gray-500">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  );
}