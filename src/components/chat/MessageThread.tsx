import { MessageSquare, X } from "lucide-react";
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
import type { NostrEvent } from "@nostrify/nostrify";
import { Button } from "../ui/button";

interface MessageThreadProps {
  rootMessage: NostrEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateToDMs?: (targetPubkey: string) => void;
}

export function MessageThread(
  { rootMessage, open, onOpenChange, onNavigateToDMs }: MessageThreadProps,
) {
  const { data: replies, isLoading } = useThreadReplies(rootMessage.id);
  const replyCount = replies?.length || 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[480px] sm:w-[540px] bg-background border-l flex flex-col h-full"
      >
        <SheetHeader className="border-b pb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5" />
              <span>Thread</span>
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
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
          <ThreadReplyInput rootMessage={rootMessage} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
