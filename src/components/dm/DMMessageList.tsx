import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { DMMessageItem } from "./DMMessageItem";
import { useDMMessages } from "@/hooks/useDMMessages";

interface DMMessageListProps {
  conversationId: string;
  onNavigateToDMs?: (targetPubkey: string) => void;
}

export function DMMessageList({ conversationId, onNavigateToDMs }: DMMessageListProps) {
  const { data: messages, isLoading } = useDMMessages(conversationId);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (isLoading) {
    return (
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 py-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex space-x-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-2">
                  <Skeleton className="w-16 h-3" />
                  <Skeleton className="w-12 h-3" />
                </div>
                <Skeleton className="w-full h-4" />
                <Skeleton className="w-3/4 h-4" />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <ScrollArea className="flex-1 px-4">
        <div className="flex flex-col items-center justify-center h-full text-center py-16">
          <div className="text-6xl mb-4">👋</div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Start the conversation!
          </h3>
          <p className="text-gray-400 max-w-md">
            This is the beginning of your direct message history. Say hello!
          </p>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="flex-1 px-4" ref={scrollAreaRef}>
      <div className="space-y-4 py-4">
        {messages.map((message, index) => {
          const previousMessage = index > 0 ? messages[index - 1] : null;
          const showAvatar = !previousMessage ||
            previousMessage.pubkey !== message.pubkey ||
            (message.created_at - previousMessage.created_at) > 300; // 5 minutes

          return (
            <DMMessageItem
              key={message.id}
              message={message}
              conversationId={conversationId}
              showAvatar={showAvatar}
              onNavigateToDMs={onNavigateToDMs}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}