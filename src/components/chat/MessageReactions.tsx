import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmojiPickerComponent } from "@/components/ui/emoji-picker";
import { ReactionDetailsDialog } from "./ReactionDetailsDialog";
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
  const [showReactionDetails, setShowReactionDetails] = useState(false);

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

  const handleReactionClick = () => {
    // Open reaction details dialog instead of adding reaction
    setShowReactionDetails(true);
    
    // Hide hover actions after clicking a reaction
    onReactionClick?.();
  };

  const hasUserReacted = (emoji: string) => {
    if (!user) return false;
    return groupedReactions[emoji]?.some(r => r.pubkey === user.pubkey) || false;
  };

  // Calculate total reactions for dialog
  const totalReactions = Object.values(groupedReactions).reduce((sum, reactions) => sum + reactions.length, 0);

  return (
    <>
      <div className="flex flex-wrap gap-1">
        {Object.entries(groupedReactions).map(([emoji, reactionList]) => (
          <Button
            key={emoji}
            variant="ghost"
            size="sm"
            className={`h-6 px-2 text-muted-foreground hover:text-nostr-purple hover:bg-nostr-purple/10 border border-transparent hover:border-nostr-purple/20 ${
              hasUserReacted(emoji) ? 'bg-gray-800/80 text-gray-100' : ''
            }`}
            onClick={handleReactionClick}
            title="Click to see who reacted"
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
              title="Add reaction"
            >
              <Plus className="w-3 h-3" />
            </Button>
          }
          side="top"
          align="start"
        />
      </div>

      {/* Reaction Details Dialog */}
      <ReactionDetailsDialog
        open={showReactionDetails}
        onOpenChange={setShowReactionDetails}
        reactionGroups={groupedReactions}
        totalReactions={totalReactions}
      />
    </>
  );
}