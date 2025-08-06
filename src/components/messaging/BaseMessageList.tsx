import { useMemo } from "react";
import { Virtuoso } from "react-virtuoso";
import { BaseMessageItem, type BaseMessageItemProps } from "./BaseMessageItem";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import type { NostrEvent } from "@nostrify/nostrify";

interface BaseMessageListProps {
  messages: NostrEvent[];
  pinnedMessageIds?: string[];
  isLoading: boolean;
  hasMore?: boolean;
  loadMore?: () => void;
  config: {
    showPinnedMessages: boolean;
    showAvatars: boolean;
  };
  messageItemProps: Omit<BaseMessageItemProps, "message" | "showAvatar">;
}

export function BaseMessageList({
  messages,
  pinnedMessageIds = [],
  isLoading,
  config,
  messageItemProps,
}: BaseMessageListProps) {
  const regularMessages = useMemo(() => {
    return messages.filter((message) => !pinnedMessageIds.includes(message.id));
  }, [messages, pinnedMessageIds]);

  const pinnedMessages = useMemo(() => {
    return messages.filter((message) => pinnedMessageIds.includes(message.id));
  }, [messages, pinnedMessageIds]);

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
      {config.showPinnedMessages && pinnedMessages.length > 0 && (
        <div className="border-b">
          {/* This might need to be a more generic component later */}
          {/* For now, this is a placeholder */}
          <div className="p-2 text-center text-sm bg-secondary">
            Pinned Messages
          </div>
          {pinnedMessages.map((message) => (
            <BaseMessageItem
              key={message.id}
              message={message}
              showAvatar={true}
              {...messageItemProps}
            />
          ))}
        </div>
      )}
      <Virtuoso
        className={`flex-1 px-4 channel-scroll scrollbar-thin`}
        style={{ width: "100%", maxWidth: "100%", overflowX: "hidden" }}
        data={regularMessages}
        itemContent={(index, message) => {
          const previousMessage = index > 0 ? regularMessages[index - 1] : null;

          // Logic to decide if we show the avatar, based on sender and time gap.
          const showAvatar = config.showAvatars && (
            !previousMessage ||
            previousMessage.pubkey !== message.pubkey ||
            (message.created_at - previousMessage.created_at) > 300 // 5 minutes
          );

          return (
            <div className="message-item w-full max-w-full overflow-hidden">
              <BaseMessageItem
                message={message}
                showAvatar={showAvatar}
                {...messageItemProps}
              />
            </div>
          );
        }}
        followOutput="smooth"
        initialTopMostItemIndex={regularMessages.length - 1}
      />
    </div>
  );
}
