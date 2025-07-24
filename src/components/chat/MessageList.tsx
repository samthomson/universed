import { useEffect, useRef, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageItem } from "./MessageItem";
import { PinnedMessages } from "./PinnedMessages";
import { useMessages } from "@/hooks/useMessages";
import { usePinnedMessages } from "@/hooks/usePinnedMessages";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useCanAccessChannel } from "@/hooks/useChannelPermissions";
import { Lock } from "lucide-react";

interface MessageListProps {
  communityId: string;
  channelId: string;
  onNavigateToDMs?: (targetPubkey: string) => void;
}

export function MessageList({ communityId, channelId, onNavigateToDMs }: MessageListProps) {
  const isMobile = useIsMobile();
  const { data: messages, isLoading } = useMessages(communityId, channelId);
  const { data: pinnedMessageIds } = usePinnedMessages(communityId, channelId);
  const { canAccess: canRead, reason } = useCanAccessChannel(communityId, channelId, 'read');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Filter out pinned messages from regular message list
  const regularMessages = useMemo(() => {
    return messages?.filter(message =>
      !pinnedMessageIds?.includes(message.id)
    ) || [];
  }, [messages, pinnedMessageIds]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [regularMessages]);

  // If user doesn't have read access, show access denied message
  if (!canRead) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <ScrollArea className="flex-1 px-4">
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <Lock className="w-16 h-16 text-gray-500 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              Private Channel
            </h3>
            <p className="text-gray-400 max-w-md">
              {reason || "You don't have permission to view this channel"}
            </p>
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <PinnedMessages
          communityId={communityId}
          channelId={channelId}
          onNavigateToDMs={onNavigateToDMs}
        />
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 py-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex space-x-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Skeleton className="w-20 h-4" />
                    <Skeleton className="w-16 h-3" />
                  </div>
                  <Skeleton className="w-full h-4" />
                  <Skeleton className="w-3/4 h-4" />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <PinnedMessages
          communityId={communityId}
          channelId={channelId}
          onNavigateToDMs={onNavigateToDMs}
        />
        <ScrollArea className="flex-1 px-4">
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="text-6xl mb-4">👋</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Welcome to #{channelId}!
            </h3>
            <p className="text-gray-400 max-w-md">
              This is the beginning of the #{channelId} channel. Start the conversation!
            </p>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PinnedMessages
        communityId={communityId}
        channelId={channelId}
        onNavigateToDMs={onNavigateToDMs}
      />
      <ScrollArea className={`flex-1 ${isMobile ? 'px-3' : 'px-4'} ${isMobile ? 'mobile-scroll' : ''}`} ref={scrollAreaRef}>
        <div className={`${isMobile ? 'space-y-3' : 'space-y-4'} py-4`}>
          {regularMessages.map((message, index) => {
            const previousMessage = index > 0 ? regularMessages[index - 1] : null;
            const showAvatar = !previousMessage ||
              previousMessage.pubkey !== message.pubkey ||
              (message.created_at - previousMessage.created_at) > 300; // 5 minutes

            return (
              <div key={message.id} className={isMobile ? 'message-enter' : ''}>
                <MessageItem
                  message={message}
                  showAvatar={showAvatar}
                  communityId={communityId}
                  channelId={channelId}
                  onNavigateToDMs={onNavigateToDMs}
                />
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}