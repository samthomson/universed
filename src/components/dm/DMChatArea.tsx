import { ArrowLeft, Phone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { genUserName } from "@/lib/genUserName";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useDMMessages } from "@/hooks/useDMMessages";
import { useSendDM } from "@/hooks/useSendDM";
import { BaseChatArea } from "@/components/messaging/BaseChatArea";
import {
  dmMessageInputConfig,
  dmMessageItemConfig,
  dmMessageListConfig,
} from "@/components/messaging/configs/dmConfig";
import type { NostrEvent } from "@nostrify/nostrify";
import { useToast } from "@/hooks/useToast";


interface DMChatAreaProps {
  conversationId: string; // The other person's pubkey
  onNavigateToDMs?: (targetPubkey: string) => void;
  onBack?: () => void; // For mobile navigation
  onMessageSent?: (recipientPubkey: string) => void; // Callback when a message is sent
}

function DMChatHeader({
  conversationId,
  onBack
}: {
  conversationId: string;
  onBack?: () => void;
}) {
  const isMobile = useIsMobile();
  const author = useAuthor(conversationId);
  const metadata = author.data?.metadata;

  const displayName = metadata?.name || genUserName(conversationId);
  const profileImage = metadata?.picture;

  return (
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
  );
}

export function DMChatArea(
  { conversationId, onNavigateToDMs, onBack, onMessageSent }: DMChatAreaProps,
) {
  const { data: messages, isLoading, hasMoreMessages, loadingOlderMessages, loadOlderMessages } = useDMMessages(conversationId);
  const { mutate: sendDM } = useSendDM();
  const { mutateAsync: createEvent } = useNostrPublish();
  const author = useAuthor(conversationId);
  const metadata = author.data?.metadata;
  const { user } = useCurrentUser();
  const { toast } = useToast();

  const displayName = metadata?.name || genUserName(conversationId);

  const handleSendMessage = async (content: string) => {
    await sendDM({
      recipientPubkey: conversationId,
      content,
    });

    // Call the callback to notify that a message was sent
    onMessageSent?.(conversationId);
  };

  const handleDeleteMessage = async (message: NostrEvent) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to delete messages",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create deletion event
      await createEvent({
        kind: 5, // Deletion event kind
        content: "Message deleted",
        tags: [
          ['e', message.id],
          ['k', message.kind.toString()],
        ],
      });

      toast({
        title: "Message deleted",
        description: "Your message has been deleted",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete message. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <BaseChatArea
      messages={messages || []}
      isLoading={isLoading}
      onSendMessage={handleSendMessage}
      onDelete={handleDeleteMessage}
      queryKey={['dm-messages', user!.pubkey, conversationId]}
      header={
        <DMChatHeader
          conversationId={conversationId}
          onBack={onBack}
        />
      }
      messageListConfig={dmMessageListConfig}
      messageItemConfig={dmMessageItemConfig}
      messageInputConfig={dmMessageInputConfig}
      inputPlaceholder={`Message ${displayName}`}
      onNavigateToDMs={onNavigateToDMs}
      hasMoreMessages={hasMoreMessages}
      loadingOlderMessages={loadingOlderMessages}
      onLoadOlderMessages={loadOlderMessages}
    />
  );
}
