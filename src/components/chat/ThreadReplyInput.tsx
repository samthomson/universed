import { useQueryClient } from "@tanstack/react-query";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { BaseMessageInput } from "@/components/messaging/BaseMessageInput";
import { groupMessageInputConfig } from "@/components/messaging/configs/groupConfig";
import type { NostrEvent } from "@/types/nostr";

interface ThreadReplyInputProps {
  rootMessage: NostrEvent;
  threadReplies?: NostrEvent[];
  communityId?: string;
  channelId?: string;
}

export function ThreadReplyInput({ rootMessage, threadReplies, communityId, channelId }: ThreadReplyInputProps) {

  const { user } = useCurrentUser();
  const { mutateAsync: createEvent } = useNostrPublish();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSendMessage = async (content: string, additionalTags: string[][]) => {
    if (!user) return;

    const queryKey = ['thread-replies', rootMessage.id];

    try {
      const tags = [
        // NIP-10 threading tags
        ["e", rootMessage.id, "", "root"], // Root event
        ["p", rootMessage.pubkey], // Root author
        ...additionalTags, // Add any additional tags (like imeta for files, p tags for mentions)
      ];

      // Thread replies should NOT include channel or community tags
      // This prevents them from appearing in the main channel feed
      // They are discovered through the e-tag reference to the root message

      const replyEvent = await createEvent({
        kind: 1111, // Thread replies should be kind 1111 (Comment) events per NIP-22
        content,
        tags,
      });

      if (replyEvent) {
        // Create optimistic version from the real event
        const optimisticReply: NostrEvent = {
          ...replyEvent,
          isSending: true, // Mark as sending state for optimistic UI
          clientFirstSeen: Date.now(), // Mark for animation
        };

        // Add optimistic reply to cache immediately
        queryClient.setQueryData(queryKey, (old: NostrEvent[] | undefined) => {
          const oldReplies = old || [];
          return [...oldReplies, optimisticReply].sort((a, b) => a.created_at - b.created_at);
        });
      }

      // Refresh thread replies to get the real reply from relay
      queryClient.invalidateQueries({
        queryKey
      });

    } catch (error) {
      console.error("Failed to send reply:", error);
      toast({
        title: "Error",
        description: "Failed to send reply. Please try again.",
        variant: "destructive",
      });
      throw error; // Re-throw to let BaseMessageInput handle the error state
    }
  };

  if (!user) {
    return (
      <div className="text-center text-muted-foreground py-4">
        <p className="text-sm">You must be logged in to reply</p>
      </div>
    );
  }

  return (
    <BaseMessageInput
      onSendMessage={handleSendMessage}
      config={groupMessageInputConfig}
      placeholder="Reply to thread..."
      isSending={false}
      communityId={communityId}
      channelId={channelId}
      rootMessage={rootMessage}
      threadReplies={threadReplies}
    />
  );
}