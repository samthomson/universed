import { useState, useRef, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

      // If this is a community message, preserve community context
      if (rootMessage.kind === 1111) {
        const aTag = rootMessage.tags.find(([name]) => name === 'a' || name === 'A');
        const pTag = rootMessage.tags.find(([name, , , role]) => name === 'p' && !role); // Community creator
        const kTag = rootMessage.tags.find(([name]) => name === 'k' || name === 'K');
        
        if (aTag) tags.push(["a", aTag[1]]);
        if (pTag) tags.push(["p", pTag[1]]);
        if (kTag) tags.push(["k", kTag[1]]);
      }

      await createEvent({
        kind: rootMessage.kind === 1111 ? 1111 : 1, // Match the root message kind
        content: reply.trim(),
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
            className="min-h-[40px] max-h-[120px] resize-none bg-transparent border-0 focus-visible:ring-0 text-gray-100 placeholder:text-gray-400 p-0"
            disabled={isSubmitting}
          />
        </div>

        {/* Send Button */}
        {reply.trim() && (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            size="icon"
            className="w-8 h-8 bg-indigo-600 hover:bg-indigo-700 text-white flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      {/* Helper Text */}
      <div className="mt-1 text-xs text-gray-500">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  );
}