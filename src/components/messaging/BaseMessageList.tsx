import { useMemo } from "react";
import { Virtuoso } from "react-virtuoso";
import { BaseMessageItem, type BaseMessageItemProps } from "./BaseMessageItem";
import { PinnedMessages } from "@/components/chat/PinnedMessages";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Hash } from "lucide-react";
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
  communityId?: string;
  channelId?: string;
}

export function BaseMessageList({
  messages,
  pinnedMessageIds = [],
  isLoading,
  config,
  messageItemProps,
  communityId,
  channelId,
}: BaseMessageListProps) {
  const regularMessages = useMemo(() => {
    return messages.filter((message) => !pinnedMessageIds.includes(message.id));
  }, [messages, pinnedMessageIds]);

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col min-h-0 p-4 space-y-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div className="flex items-start space-x-4" key={i}>
            <Skeleton className="h-10 w-10 rounded-full bg-blue-600/20" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[250px] bg-blue-600/20" />
              <Skeleton className="h-4 w-[200px] bg-blue-600/20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="col-span-full flex-1 flex items-center justify-center">
        <Card className="border-dashed border-purple-200 dark:border-purple-800 w-full max-w-md mx-4 bg-purple-50 dark:bg-purple-900/10 backdrop-blur-sm rounded-2xl">
          <CardContent className="py-12 px-8 text-center">
            <div className="max-w-sm mx-auto space-y-6">
              <div className="p-4 bg-purple-100 dark:bg-purple-900/20 rounded-full border border-purple-200 dark:border-purple-800 inline-block">
                <Hash className="w-12 h-12 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">No Messages Yet</h3>
              <p className="text-gray-600 dark:text-gray-400">
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
        className={`flex-1 channel-scroll scrollbar-thin`}
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
            <div className="message-item w-full max-w-full overflow-hidden px-4">
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
        followOutput="smooth"
        initialTopMostItemIndex={regularMessages.length - 1}
      />
    </div>
  );
}
