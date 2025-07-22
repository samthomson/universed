import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useReactions } from "@/hooks/useReactions";
import { useAddReaction } from "@/hooks/useAddReaction";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { NostrEvent } from "@nostrify/nostrify";

interface MessageReactionsProps {
  message: NostrEvent;
}

const COMMON_EMOJIS = [
  "👍", "👎", "❤️", "😂", "😮", "😢", "😡", "🎉", "🔥", "💯"
];

export function MessageReactions({ message }: MessageReactionsProps) {
  const { data: reactions } = useReactions(message.id);
  const { mutate: addReaction } = useAddReaction();
  const { user } = useCurrentUser();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  if (!reactions || reactions.length === 0) {
    return null;
  }

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, reaction) => {
    const emoji = reaction.content || "👍";
    if (!acc[emoji]) {
      acc[emoji] = [];
    }
    acc[emoji].push(reaction);
    return acc;
  }, {} as Record<string, NostrEvent[]>);

  const handleReaction = (emoji: string) => {
    if (!user) return;

    addReaction({
      targetEvent: message,
      emoji,
    });
    setShowEmojiPicker(false);
  };

  const hasUserReacted = (emoji: string) => {
    if (!user) return false;
    return groupedReactions[emoji]?.some(r => r.pubkey === user.pubkey) || false;
  };

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {Object.entries(groupedReactions).map(([emoji, reactionList]) => (
        <Button
          key={emoji}
          variant={hasUserReacted(emoji) ? "secondary" : "ghost"}
          size="sm"
          className="h-6 px-2 text-xs hover:bg-gray-600"
          onClick={() => handleReaction(emoji)}
        >
          <span className="mr-1">{emoji}</span>
          <span>{reactionList.length}</span>
        </Button>
      ))}

      {/* Add Reaction Button */}
      <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-gray-400 hover:text-gray-300 hover:bg-gray-600"
          >
            <Plus className="w-3 h-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" side="top">
          <div className="grid grid-cols-5 gap-1">
            {COMMON_EMOJIS.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-gray-600"
                onClick={() => handleReaction(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}