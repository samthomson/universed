import { MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MessageItem } from "./MessageItem";
import { ThreadReplyInput } from "./ThreadReplyInput";
import { useThreadReplies } from "@/hooks/useThreadReplies";
import type { NostrEvent } from "@nostrify/nostrify";

interface MessageThreadProps {
  rootMessage: NostrEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateToDMs?: (targetPubkey: string) => void;
}

export function MessageThread({ rootMessage, open, onOpenChange, onNavigateToDMs }: MessageThreadProps) {
  const { data: replies, isLoading } = useThreadReplies(rootMessage.id);
  const replyCount = replies?.length || 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:w-[540px] bg-gray-800 border-gray-600 flex flex-col h-full">
        <SheetHeader className="border-b border-gray-600 pb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-white flex items-center space-x-2">
              <MessageSquare className="w-5 h-5" />
              <span>Thread</span>
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="text-gray-400 hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="text-sm text-gray-400">
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </div>
        </SheetHeader>

        {/* Root Message */}
        <div className="border-b border-gray-600 pb-4 mb-4 flex-shrink-0">
          <MessageItem message={rootMessage} showAvatar={true} onNavigateToDMs={onNavigateToDMs} />
        </div>

        {/* Replies - This takes up remaining space */}
        <ScrollArea className="flex-1 -mx-6 px-6 min-h-0">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex space-x-3">
                    <div className="w-8 h-8 bg-gray-600 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-600 rounded w-1/4" />
                      <div className="h-4 bg-gray-600 rounded w-3/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : replies && replies.length > 0 ? (
            <div className="space-y-4 pb-4">
              {replies.map((reply, index) => {
                const previousReply = index > 0 ? replies[index - 1] : null;
                const showAvatar = !previousReply ||
                  previousReply.pubkey !== reply.pubkey ||
                  (reply.created_at - previousReply.created_at) > 300; // 5 minutes

                return (
                  <MessageItem
                    key={reply.id}
                    message={reply}
                    showAvatar={showAvatar}
                    onNavigateToDMs={onNavigateToDMs}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No replies yet</p>
              <p className="text-xs">Be the first to reply!</p>
            </div>
          )}
        </ScrollArea>

        {/* Reply Input - Fixed at bottom */}
        <div className="border-t border-gray-600 pt-4 flex-shrink-0">
          <ThreadReplyInput rootMessage={rootMessage} />
        </div>
      </SheetContent>
    </Sheet>
  );
}