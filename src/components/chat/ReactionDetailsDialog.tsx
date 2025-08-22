import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuthorBatch } from "@/hooks/useAuthorBatch";
import { genUserName } from "@/lib/genUserName";
import type { NostrEvent } from "@/types/nostr";

interface ReactionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reactionGroups: Record<string, NostrEvent[]>;
  totalReactions: number;
}

export function ReactionDetailsDialog({
  open,
  onOpenChange,
  reactionGroups,
  totalReactions,
}: ReactionDetailsDialogProps) {

  // Get all unique pubkeys from all reactions
  const allPubkeys = Array.from(
    new Set(
      Object.values(reactionGroups)
        .flat()
        .map(reaction => reaction.pubkey)
    )
  );

  const { data: authors } = useAuthorBatch(allPubkeys);

  // Create a flattened list of all reactions with emoji info
  const allReactions = Object.entries(reactionGroups).flatMap(([emoji, reactions]) =>
    reactions.map(reaction => ({ ...reaction, emoji }))
  );

  // Sort by most recent first
  const sortedAllReactions = allReactions.sort((a, b) => b.created_at - a.created_at);

  const getDisplayName = (pubkey: string) => {
    const author = authors?.[pubkey];
    return author?.metadata?.name || genUserName(pubkey);
  };

  const getProfileImage = (pubkey: string) => {
    const author = authors?.[pubkey];
    return author?.metadata?.picture;
  };

  // Create a more specific description based on the reactions
  const getDescription = () => {
    const emojis = Object.keys(reactionGroups);
    if (emojis.length === 1) {
      return `${totalReactions} ${totalReactions === 1 ? 'person' : 'people'} reacted with ${emojis[0]}`;
    } else if (emojis.length === 2) {
      return `Reactions with ${emojis.join(' and ')}`;
    } else {
      return `Reactions from ${emojis.slice(0, -1).join(', ')} to ${emojis[emojis.length - 1]}`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">
            <span className="tabular-nums">{totalReactions}</span>{' '}
            {totalReactions === 1 ? 'Reaction' : 'Reactions'}
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-48 w-full">
          <div className="space-y-1">
            {sortedAllReactions.map((reaction) => (
              <div key={`${reaction.pubkey}-${reaction.emoji}-${reaction.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                <div className="flex items-center space-x-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={getProfileImage(reaction.pubkey)} />
                    <AvatarFallback className="text-xs">
                      {getDisplayName(reaction.pubkey).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">
                    {getDisplayName(reaction.pubkey)}
                  </span>
                </div>
                <span className="text-lg">{reaction.emoji}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
