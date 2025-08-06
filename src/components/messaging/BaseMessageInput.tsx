import { KeyboardEvent, useRef, useState } from "react";
import { Plus, Send, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmojiPickerComponent } from "@/components/ui/emoji-picker";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import type { NostrEvent } from "@nostrify/nostrify";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useCurrentUser();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!user || !message.trim() || isSending) return;

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
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      }, 0);
    }
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
      <div className="flex items-end space-x-3">
        {config.allowFileUpload && (
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-muted-foreground hover:text-foreground"
          >
            <Plus className="w-5 h-5" />
          </Button>
        )}
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
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
          disabled={isSending || !message.trim()}
          size="icon"
          className="w-8 h-8 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
