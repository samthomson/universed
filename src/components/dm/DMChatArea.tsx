import { ArrowLeft, Phone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useDMMessages } from "@/hooks/useDMMessages";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";

import { BaseMessageList } from "@/components/messaging/BaseMessageList";
import { BaseMessageInput } from "@/components/messaging/BaseMessageInput";
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

export function DMChatArea(
  { conversationId, onNavigateToDMs, onBack }: DMChatAreaProps,
) {
  const isMobile = useIsMobile();
  const author = useAuthor(conversationId);
  const metadata = author.data?.metadata;
  const { user } = useCurrentUser();

  const { data: messages, isLoading } = useDMMessages(conversationId);
  const { mutateAsync: createEvent, isPending: isSending } = useNostrPublish();

  const displayName = metadata?.name || genUserName(conversationId);
  const profileImage = metadata?.picture;

  const handleSendMessage = async (content: string) => {
    if (!user) return;
    await createEvent({
      kind: 4,
      content,
      tags: [["p", conversationId]],
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
            isSending={isSending}
          />
        </div>
      </div>
    </div>
  );
}
