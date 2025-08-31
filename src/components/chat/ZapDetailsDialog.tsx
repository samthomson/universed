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
import { formatDistanceToNowShort } from "@/lib/formatTime";
import { Zap } from "lucide-react";
import { nip57 } from "nostr-tools";
import pluralize from "pluralize";
import type { NostrEvent } from "@/types/nostr";

interface ZapDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zaps: NostrEvent[];
  zapCount: number;
  totalSats: number;
}

export function ZapDetailsDialog({
  open,
  onOpenChange,
  zaps,
  zapCount,
  totalSats,
}: ZapDetailsDialogProps) {

  // Get all unique pubkeys from all zaps
  const allPubkeys = Array.from(
    new Set(
      zaps.map(zap => zap.pubkey)
    )
  );

  const { data: authors } = useAuthorBatch(allPubkeys);

  // Extract zap amounts and sort by amount (highest first)
  const zapsWithAmounts = zaps.map(zap => {
    let amount = 0;

    // Try multiple methods to extract the amount:
    // Method 1: amount tag (from zap request, sometimes copied to receipt)
    const amountTag = zap.tags.find(([name]) => name === 'amount')?.[1];
    if (amountTag) {
      const millisats = parseInt(amountTag);
      amount = Math.floor(millisats / 1000);
      return { ...zap, amount };
    }

    // Method 2: Extract from bolt11 invoice
    const bolt11Tag = zap.tags.find(([name]) => name === 'bolt11')?.[1];
    if (bolt11Tag) {
      try {
        const invoiceSats = nip57.getSatoshisAmountFromBolt11(bolt11Tag);
        return { ...zap, amount: invoiceSats };
      } catch (error) {
        console.warn('Failed to parse bolt11 amount:', error);
      }
    }

    // Method 3: Parse from description (zap request JSON)
    const descriptionTag = zap.tags.find(([name]) => name === 'description')?.[1];
    if (descriptionTag) {
      try {
        const zapRequest = JSON.parse(descriptionTag);
        const requestAmountTag = zapRequest.tags?.find(([name]: string[]) => name === 'amount')?.[1];
        if (requestAmountTag) {
          const millisats = parseInt(requestAmountTag);
          amount = Math.floor(millisats / 1000);
          return { ...zap, amount };
        }
      } catch (error) {
        console.warn('Failed to parse description JSON:', error);
      }
    }

    return { ...zap, amount };
  }).sort((a, b) => b.amount - a.amount); // Sort by amount descending

  const getDisplayName = (pubkey: string) => {
    const author = authors?.[pubkey];
    return author?.metadata?.name || genUserName(pubkey);
  };

  const getProfileImage = (pubkey: string) => {
    const author = authors?.[pubkey];
    return author?.metadata?.picture;
  };

  // Extract zap comment from description
  const getZapComment = (zap: NostrEvent) => {
    const descriptionTag = zap.tags.find(([name]) => name === 'description')?.[1];
    if (descriptionTag) {
      try {
        const zapRequest = JSON.parse(descriptionTag);
        return zapRequest.content || '';
      } catch (error) {
        console.warn('Failed to parse description JSON:', error);
      }
    }
    return '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center flex items-center justify-center gap-2">
            <Zap className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <span className="tabular-nums">{totalSats.toLocaleString()}</span>{' '}
            sats
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            {zapCount} {pluralize('zap', zapCount)} from {pluralize('person', allPubkeys.length)}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-64 w-full">
          <div className="space-y-2">
            {zapsWithAmounts.map((zap) => (
              <div key={`${zap.pubkey}-${zap.id}`} className="flex items-start justify-between p-3 rounded-lg hover:bg-muted/50">
                <div className="flex items-start space-x-3 flex-1">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={getProfileImage(zap.pubkey)} />
                    <AvatarFallback className="text-xs">
                      {getDisplayName(zap.pubkey).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {getDisplayName(zap.pubkey)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNowShort(new Date(zap.created_at * 1000), { addSuffix: true })}
                      </span>
                    </div>
                    {getZapComment(zap) && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {getZapComment(zap)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 ml-2">
                  <Zap className="w-3 h-3" />
                  <span className="text-sm font-medium tabular-nums">
                    {zap.amount.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}