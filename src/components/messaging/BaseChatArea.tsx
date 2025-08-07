import { useQueryClient, useMutation } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { BaseMessageList } from "./BaseMessageList";
import { BaseMessageInput } from "./BaseMessageInput";
import type { NostrEvent } from "@/types/nostr";

interface BaseChatAreaProps {
  messages: NostrEvent[];
  isLoading: boolean;
  onSendMessage: (content: string) => Promise<void>;
  queryKey: string[]; // Specific query key for this chat context
  header: React.ReactNode;
  messageListConfig: {
    showPinnedMessages: boolean;
    showAvatars: boolean;
  };
  messageItemConfig: {
    showContextMenu: boolean;
    showReactions: boolean;
    showThreadReply: boolean;
    showPin: boolean;
    showDelete: boolean;
    showBan: boolean;
    showReport: boolean;
  };
  messageInputConfig: {
    allowMentions: boolean;
    allowFileUpload: boolean;
    allowEmoji: boolean;
  };
  inputPlaceholder?: string;
  onNavigateToDMs?: (targetPubkey: string) => void;
  onReply?: (message: NostrEvent) => void;
  onPin?: (message: NostrEvent) => void;
  onDelete?: (message: NostrEvent, reason?: string) => void;
  onBan?: (pubkey: string, reason?: string) => void;
  additionalContent?: React.ReactNode;
  communityId?: string;
  channelId?: string;
}

export function BaseChatArea({
  messages,
  isLoading,
  onSendMessage,
  queryKey,
  header,
  messageListConfig,
  messageItemConfig,
  messageInputConfig,
  inputPlaceholder,
  onNavigateToDMs,
  onReply,
  onPin,
  onDelete,
  onBan,
  additionalContent,
  communityId,
  channelId,
}: BaseChatAreaProps) {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  // Optimistic message sending mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content }: { content: string }) => {
      await onSendMessage(content);
    },
    onMutate: async ({ content }) => {
      // Cancel any outgoing refetches for this specific chat
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousMessages = messages;

      // Create optimistic message
      const now = Date.now();
      const optimisticMessage: NostrEvent = {
        id: `optimistic-${now}`,
        pubkey: user!.pubkey,
        created_at: Math.floor(now / 1000),
        kind: 1, // Default kind, will be overridden by actual implementation
        tags: [],
        content,
        sig: '', // Will be filled by the actual event
        isSending: true, // Mark as sending state for optimistic UI
        clientFirstSeen: now, // Mark for animation
      };

      // Optimistically update to the new value for this specific chat context
      queryClient.setQueryData(queryKey, old => {
        const oldMessages = Array.isArray(old) ? old : [];
        return [...oldMessages, optimisticMessage];
      });

      // Return a context object with the snapshotted value
      return { previousMessages, optimisticMessage };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousMessages) {
        queryClient.setQueryData(queryKey, context.previousMessages);
      }
      logger.error('Failed to send message:', err);
    },
    onSettled: () => {
      // Always refetch after error or success to make sure we're in sync
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const handleSendMessage = async (content: string, _tags: string[][]) => {
    if (!user) return;

    sendMessageMutation.mutate({
      content,
    });
  };

  return (
    <div className="flex flex-col h-full">
      {header}

      <div className="flex-1 flex flex-col min-h-0">
        <BaseMessageList
          messages={messages}
          isLoading={isLoading}
          config={messageListConfig}
          communityId={communityId}
          channelId={channelId}
          messageItemProps={{
            config: messageItemConfig,
            onNavigateToDMs,
            onReply,
            onPin,
            onDelete,
            onBan,
          }}
        />

        {additionalContent}

        <div className="flex-shrink-0">
          <div className="p-4">
            <BaseMessageInput
              onSendMessage={handleSendMessage}
              config={messageInputConfig}
              placeholder={inputPlaceholder || "Type a message..."}
              isSending={sendMessageMutation.isPending}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
