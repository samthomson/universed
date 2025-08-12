import { MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BaseMessageItem } from "@/components/messaging/BaseMessageItem";
import { groupMessageItemConfig } from "@/components/messaging/configs/groupConfig";
import { ThreadReplyInput } from "./ThreadReplyInput";
import { useThreadReplies } from "@/hooks/useThreadReplies";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { NostrEvent } from "@nostrify/nostrify";

interface MessageThreadProps {
  rootMessage: NostrEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateToDMs?: (targetPubkey: string) => void;
  communityId?: string;
  channelId?: string;
}

export function MessageThread(
  { rootMessage, open, onOpenChange, onNavigateToDMs, communityId, channelId }: MessageThreadProps,
) {
  const { data: replies, isLoading } = useThreadReplies(rootMessage.id);
  const replyCount = replies?.length || 0;
  const isMobile = useIsMobile();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={`
          ${isMobile
            ? "w-full sm:w-[480px] md:w-[540px] h-[90vh] max-h-[90vh] rounded-t-xl border-t"
            : "w-[480px] sm:w-[540px] h-full border-l"
          }
          bg-background flex flex-col
        `}
      >
        <SheetHeader className="border-b pb-4 flex-shrink-0">
          <SheetTitle className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5" />
            <span>Thread</span>
          </SheetTitle>
          <div className="text-sm text-muted-foreground">
            {replyCount} {replyCount === 1 ? "reply" : "replies"}
          </div>
        </SheetHeader>

        <div className="border-b pb-4 mb-4 flex-shrink-0">
          <BaseMessageItem
            message={rootMessage}
            showAvatar={true}
            config={groupMessageItemConfig}
            onNavigateToDMs={onNavigateToDMs}
          />
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6 min-h-0">
          {isLoading
            ? (
              <div className="space-y-4">
                {/* Skeleton Loader */}
              </div>
            )
            : replies && replies.length > 0
            ? (
              <div className="space-y-4 pb-4">
                {replies.map((reply, index) => {
                  const previousReply = index > 0 ? replies[index - 1] : null;
                  const showAvatar = !previousReply ||
                    previousReply.pubkey !== reply.pubkey ||
                    (reply.created_at - previousReply.created_at) > 300; // 5 minutes

                  return (
                    <BaseMessageItem
                      key={reply.id}
                      message={reply}
                      showAvatar={showAvatar}
                      config={groupMessageItemConfig}
                      onNavigateToDMs={onNavigateToDMs}
                    />
                  );
                })}
              </div>
            )
            : (
              <div className="text-center text-muted-foreground py-8">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No replies yet</p>
              </div>
            )}
        </ScrollArea>

        <div className="border-t pt-4 flex-shrink-0">
          <ThreadReplyInput rootMessage={rootMessage} threadReplies={replies} communityId={communityId} channelId={channelId} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
