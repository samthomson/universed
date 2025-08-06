import { KeyboardEvent, useRef, useState, useEffect } from "react";
import { Plus, Send, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmojiPickerComponent } from "@/components/ui/emoji-picker";
import { EmojiAutocomplete } from "@/components/ui/emoji-autocomplete";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { extractShortcodeContext, searchEmojis, type EmojiData } from "@/lib/emojiUtils";
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
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useCurrentUser();
  const { toast } = useToast();

  // Close autocomplete when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showEmojiAutocomplete && textareaRef.current && !textareaRef.current.contains(event.target as Node)) {
        setShowEmojiAutocomplete(false);
        setShortcodeContext(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiAutocomplete]);

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
    setShowEmojiAutocomplete(false);
    setShortcodeContext(null);
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
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      }, 0);
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
          onChange={(e) => handleMessageChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onSelect={handleSelectionChange}
          onClick={handleSelectionChange}
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
      
      {showEmojiAutocomplete && (
        <EmojiAutocomplete
          query={autocompleteQuery}
          selectedIndex={selectedEmojiIndex}
          onSelect={handleEmojiAutocompleteSelect}
          onClose={() => setShowEmojiAutocomplete(false)}
        />
      )}
    </div>
  );
}
