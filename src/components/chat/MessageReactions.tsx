import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmojiPickerComponent } from "@/components/ui/emoji-picker";
import { useAddReaction } from "@/hooks/useAddReaction";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { NostrEvent } from "@/types/nostr";

interface MessageReactionsProps {
  message: NostrEvent;
  onReactionClick?: () => void;
  reactionGroups?: Record<string, NostrEvent[]>;
}

export function MessageReactions({ message, onReactionClick, reactionGroups }: MessageReactionsProps) {
  const { mutate: addReaction } = useAddReaction();
  const { user } = useCurrentUser();

  if (!reactionGroups || Object.keys(reactionGroups).length === 0) {
    return null;
  }

  const groupedReactions = reactionGroups;

  const handleEmojiSelect = (emoji: string) => {
    if (!user) return;

    addReaction({
      targetEvent: message,
      emoji,
    });
  };

  const handleReactionClick = (emoji: string) => {
    if (!user) return;

    // Toggle reaction - if user has already reacted with this emoji, it will be handled by the backend
    addReaction({
      targetEvent: message,
      emoji,
    });

    // Hide hover actions after clicking a reaction
    onReactionClick?.();
  };

  const hasUserReacted = (emoji: string) => {
    if (!user) return false;
    return groupedReactions[emoji]?.some(r => r.pubkey === user.pubkey) || false;
  };

  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(groupedReactions).map(([emoji, reactionList]) => (
        <Button
          key={emoji}
          variant="ghost"
          size="sm"
          className={`h-6 px-2 text-xs hover:bg-gray-600 ${
            hasUserReacted(emoji) ? 'bg-gray-800/80 text-gray-100' : ''
          }`}
          onClick={() => handleReactionClick(emoji)}
        >
          <span className="mr-1">{emoji}</span>
          <span>{reactionList.length}</span>
        </Button>
      ))}

      {/* Add Reaction Button with Full Emoji Picker */}
      <EmojiPickerComponent
        onEmojiSelect={handleEmojiSelect}
        trigger={
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-gray-400 hover:text-gray-300 hover:bg-gray-600"
          >
            <Plus className="w-3 h-3" />
          </Button>
        }
        side="top"
        align="start"
      />
    </div>
  );
}