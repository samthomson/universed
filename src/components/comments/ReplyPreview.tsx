import { Link } from 'react-router-dom';
import { NostrEvent } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';
import { useAuthor } from '@/hooks/useAuthor';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ChevronRight, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { genUserName } from '@/lib/genUserName';
import { cn } from '@/lib/utils';

interface ReplyPreviewProps {
  replies: NostrEvent[];
  onShowReplies: () => void;
  showReplies: boolean;
  className?: string;
}

export function ReplyPreview({ replies, onShowReplies, showReplies, className }: ReplyPreviewProps) {
  // Get the most recent reply for preview
  const latestReply = replies.length > 0 ? replies[replies.length - 1] : null;
  const latestAuthor = useAuthor(latestReply?.pubkey || '');

  // Get unique authors for avatar stack
  const uniqueAuthors = Array.from(
    new Map(replies.map(reply => [reply.pubkey, reply])).values()
  ).slice(0, 3); // Show max 3 avatars

  // Pre-fetch author data for the first 3 unique authors
  const author1 = useAuthor(uniqueAuthors[0]?.pubkey || '');
  const author2 = useAuthor(uniqueAuthors[1]?.pubkey || '');
  const author3 = useAuthor(uniqueAuthors[2]?.pubkey || '');

  if (replies.length === 0 || !latestReply) return null;

  const latestMetadata = latestAuthor.data?.metadata;
  const latestDisplayName = latestMetadata?.name ?? genUserName(latestReply.pubkey);
  const timeAgo = formatDistanceToNow(new Date(latestReply.created_at * 1000), { addSuffix: true });

  // Truncate content for preview
  const previewContent = latestReply.content.length > 80
    ? latestReply.content.slice(0, 80) + '...'
    : latestReply.content;

  return (
    <div className={cn("mt-2", className)}>
      <Button
        variant="ghost"
        onClick={onShowReplies}
        className="w-full justify-start p-3 h-auto bg-muted/30 hover:bg-muted/50 border border-muted/50 rounded-lg transition-all duration-200"
      >
        <div className="flex items-start space-x-3 w-full">
          {/* Avatar Stack */}
          <div className="flex -space-x-2 shrink-0">
            {uniqueAuthors.map((reply, index) => {
              const author = index === 0 ? author1 : index === 1 ? author2 : author3;
              const metadata = author.data?.metadata;
              const displayName = metadata?.name ?? genUserName(reply.pubkey);

              return (
                <Avatar
                  key={reply.pubkey}
                  className={cn(
                    "h-6 w-6 border-2 border-background ring-1 ring-muted",
                    index === 0 && "z-30",
                    index === 1 && "z-20",
                    index === 2 && "z-10"
                  )}
                >
                  <AvatarImage src={metadata?.picture} />
                  <AvatarFallback className="text-xs">
                    {displayName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              );
            })}
            {replies.length > 3 && (
              <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center z-0">
                <Users className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Reply Content Preview */}
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-xs font-medium text-primary">
                {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">
                Last reply {timeAgo}
              </span>
            </div>

            <div className="flex items-start space-x-2">
              <Link
                to={`/${nip19.npubEncode(latestReply.pubkey)}`}
                className="text-xs font-medium text-foreground hover:text-primary transition-colors shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {latestDisplayName}
              </Link>
              <span className="text-xs text-muted-foreground truncate">
                {previewContent}
              </span>
            </div>
          </div>

          {/* Expand Icon */}
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
              showReplies && "rotate-90"
            )}
          />
        </div>
      </Button>
    </div>
  );
}