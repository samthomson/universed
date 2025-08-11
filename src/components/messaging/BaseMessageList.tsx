import { useRef } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { BaseMessageItem, type BaseMessageItemProps } from "./BaseMessageItem";
import { PinnedMessages } from "@/components/chat/PinnedMessages";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronUp } from "lucide-react";
import type { NostrEvent } from "@nostrify/nostrify";

interface BaseMessageListProps {
  messages: NostrEvent[];
  pinnedMessageIds?: string[];
  isLoading: boolean;
  hasMore?: boolean;
  loadingOlder?: boolean;
  loadOlderMessages?: () => Promise<void>;
  reachedStartOfConversation?: boolean;
  config: {
    showPinnedMessages: boolean;
    showAvatars: boolean;
  };
  messageItemProps: Omit<BaseMessageItemProps, "message" | "showAvatar">;
  communityId?: string;
  channelId?: string;
}

export function BaseMessageList({
  messages,
  pinnedMessageIds = [],
  isLoading,
  hasMore = false,
  loadingOlder = false,
  loadOlderMessages,
  reachedStartOfConversation = false,
  config,
  messageItemProps,
  communityId,
  channelId,
}: BaseMessageListProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);  
  const regularMessages = messages.filter((message) => !pinnedMessageIds.includes(message.id));

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col min-h-0 p-4 space-y-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div className="flex items-start space-x-4" key={i}>
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="col-span-full flex-1 flex items-center justify-center">
        <Card className="border-dashed w-full max-w-md mx-4">
          <CardContent className="py-12 px-8 text-center">
            <div className="max-w-sm mx-auto space-y-6">
              <h3 className="text-xl font-semibold">No Messages Yet</h3>
              <p className="text-muted-foreground">
                Be the first to start the conversation!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">      
      {config.showPinnedMessages && communityId && channelId && (
        <PinnedMessages
          communityId={communityId}
          channelId={channelId}
          onNavigateToDMs={messageItemProps.onNavigateToDMs}
        />
      )}
      <Virtuoso
        ref={virtuosoRef}
        className="flex-1 px-4 scrollbar-thin"
        data={regularMessages}
        alignToBottom
        followOutput
        initialTopMostItemIndex={regularMessages.length - 1}
        overscan={200}
        totalCount={regularMessages.length}
        itemContent={(index, message) => {
          const previousMessage = index > 0 ? regularMessages[index - 1] : null;

          // Logic to decide if we show the avatar, based on sender and time gap.
          const showAvatar = config.showAvatars && (
            !previousMessage ||
            previousMessage.pubkey !== message.pubkey ||
            (message.created_at - previousMessage.created_at) > 300 // 5 minutes
          );

          return (
            <div className="message-item w-full max-w-full overflow-hidden py-0.5">
              <BaseMessageItem
                message={message}
                showAvatar={showAvatar}
                communityId={communityId}
                channelId={channelId}
                {...messageItemProps}
              />
            </div>
          );
        }}
        computeItemKey={(index, message) => message.id}
        components={{
          Header: () => (
            <div className="py-2 flex justify-center">
              {hasMore ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadOlderMessages?.()}
                  disabled={loadingOlder}
                  className="flex items-center gap-1"
                >
                  <ChevronUp className="h-4 w-4" />
                  {loadingOlder ? 'Loading...' : 'Load older messages'}
                </Button>
              ) : reachedStartOfConversation ? (
                <div className="text-xs text-muted-foreground py-2 px-4 border rounded-full bg-muted/30">
                  Start of conversation
                </div>
              ) : null}
            </div>
          ),
        }}
      />
    </div>
  );
}