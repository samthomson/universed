import { ArrowLeft, Phone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useDMMessages } from "@/hooks/useDMMessages";
import { useSendDM } from "@/hooks/useSendDM";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { logger } from "@/lib/logger";

import { BaseMessageList } from "@/components/messaging/BaseMessageList";
import { BaseMessageInput } from "@/components/messaging/BaseMessageInput";
import {
  dmMessageInputConfig,
  dmMessageItemConfig,
  dmMessageListConfig,
} from "@/components/messaging/configs/dmConfig";
import type { NostrEvent } from "@/types/nostr";

interface DMChatAreaProps {
  conversationId: string; // The other person's pubkey
  onNavigateToDMs?: (targetPubkey: string) => void;
  onBack?: () => void; // For mobile navigation
}

export function DMChatArea(
  { conversationId, onNavigateToDMs, onBack }: DMChatAreaProps,
) {
  const isMobile = useIsMobile();
  const author = useAuthor(conversationId);
  const metadata = author.data?.metadata;
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useDMMessages(conversationId);
  const { mutate: sendDM } = useSendDM();

  const displayName = metadata?.name || genUserName(conversationId);
  const profileImage = metadata?.picture;

  // Optimistic message sending mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content }: { content: string }) => {
      // Use the proper encrypted DM sending
      const event = await sendDM({
        recipientPubkey: conversationId,
        content,
      });
      return event;
    },
    onMutate: async ({ content }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['dm-messages', user?.pubkey, conversationId] });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData(['dm-messages', user?.pubkey, conversationId]);

      // Create optimistic message
      const optimisticMessage: NostrEvent = {
        id: `optimistic-${Date.now()}`,
        pubkey: user!.pubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 4, // This will be updated by the actual event
        tags: [["p", conversationId]],
        content, // Show the plaintext content optimistically
        sig: '', // Will be filled by the actual event
        isSending: true, // Mark as sending state for optimistic UI
      };

      // Optimistically update to the new value
      queryClient.setQueryData(['dm-messages', user?.pubkey, conversationId], old => {
        const oldMessages = Array.isArray(old) ? old : [];
        return [...oldMessages, optimisticMessage];
      });

      // Return a context object with the snapshotted value
      return { previousMessages, optimisticMessage };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousMessages) {
        queryClient.setQueryData(['dm-messages', user?.pubkey, conversationId], context.previousMessages);
      }
      logger.error('Failed to send DM:', err);
    },
    onSettled: () => {
      // Always refetch after error or success to make sure we're in sync
      queryClient.invalidateQueries({ queryKey: ['dm-messages', user?.pubkey, conversationId] });
    },
  });

  const handleSendMessage = async (content: string) => {
    if (!user) return;
    
    sendMessageMutation.mutate({
      content,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className={`${
          isMobile ? "h-14" : "h-16"
        } border-b flex items-center justify-between px-4 bg-background`}
      >
        <div className="flex items-center space-x-3">
          {isMobile && onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="w-8 h-8 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Avatar className="w-8 h-8">
            <AvatarImage src={profileImage} alt={displayName} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{displayName}</h3>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* These buttons are placeholders for future functionality */}
          <Button variant="ghost" size="icon" className="w-8 h-8">
            <Phone className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8">
            <Video className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <BaseMessageList
          messages={messages || []}
          isLoading={isLoading}
          config={dmMessageListConfig}
          messageItemProps={{
            config: dmMessageItemConfig,
            onNavigateToDMs,
          }}
        />
        <div className="p-4 border-t flex-shrink-0">
          <BaseMessageInput
            onSendMessage={handleSendMessage}
            config={dmMessageInputConfig}
            placeholder={`Message ${displayName}`}
            isSending={sendMessageMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
}
