import { ArrowLeft, Phone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthor } from "@/hooks/useAuthor";
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


interface DMChatAreaProps {
  conversationId: string; // The other person's pubkey
  onNavigateToDMs?: (targetPubkey: string) => void;
  onBack?: () => void; // For mobile navigation
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
  { conversationId, onNavigateToDMs, onBack }: DMChatAreaProps,
) {
  const { data: messages, isLoading } = useDMMessages(conversationId);
  const { mutate: sendDM } = useSendDM();
  const author = useAuthor(conversationId);
  const metadata = author.data?.metadata;

  const displayName = metadata?.name || genUserName(conversationId);

  const handleSendMessage = async (content: string) => {
    await sendDM({
      recipientPubkey: conversationId,
      content,
    });
  };

  return (
    <BaseChatArea
      messages={messages || []}
      isLoading={isLoading}
      onSendMessage={handleSendMessage}
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
    />
  );
}
