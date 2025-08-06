import { useState } from 'react';
import { Link } from 'react-router-dom';
import { NostrEvent } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';
import { useAuthor } from '@/hooks/useAuthor';
import { NoteContent } from '@/components/NoteContent';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MessageSquare, ChevronDown, ChevronRight, Reply } from 'lucide-react';
import { formatDistanceToNowShort } from '@/lib/formatTime';
import { genUserName } from '@/lib/genUserName';
import { cn } from '@/lib/utils';
import { Comment } from './Comment';

interface ThreadPreviewProps {
  root: NostrEvent | URL;
  parentComment: NostrEvent;
  replies: NostrEvent[];
  onReply: () => void;
}

export function ThreadPreview({ root, parentComment: _parentComment, replies, onReply }: ThreadPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get unique authors from replies for avatar preview
  const uniqueAuthors = Array.from(
    new Set(replies.map(reply => reply.pubkey))
  ).slice(0, 5); // Show max 5 avatars

  const latestReply = replies[replies.length - 1];
  const latestReplyAuthor = useAuthor(latestReply?.pubkey);
  const latestReplyName = latestReplyAuthor.data?.metadata?.name ?? genUserName(latestReply?.pubkey || '');
  const latestReplyTime = latestReply ? formatDistanceToNowShort(new Date(latestReply.created_at * 1000), { addSuffix: true }) : '';

  return (
    <div className="ml-4 space-y-2">
      {/* Thread Indicator Line */}
      <div className="flex items-center space-x-2 pl-6">
        <div className="w-6 h-px bg-muted" />
        <Badge variant="outline" className="h-5 px-2 text-xs bg-primary/5 border-primary/20">
          <MessageSquare className="h-3 w-3 mr-1" />
          {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
        </Badge>
      </div>

      {/* Thread Preview Card */}
      <Card className="bg-accent/10 border-primary/10 hover:bg-accent/15 transition-all cursor-pointer">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <CardContent className="p-3">
              <div className="space-y-3">
                {/* Thread Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {/* Author Avatars Stack */}
                    <div className="flex -space-x-2">
                      {uniqueAuthors.map((pubkey) => (
                        <AuthorAvatar key={pubkey} pubkey={pubkey} className="ring-2 ring-background" size="sm" />
                      ))}
                      {replies.length > 5 && (
                        <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                          <span className="text-xs font-medium text-muted-foreground">+{replies.length - 5}</span>
                        </div>
                      )}
                    </div>

                    {/* Thread Info */}
                    <div className="flex items-center space-x-2 text-sm">
                      <span className="font-medium text-muted-foreground">
                        {uniqueAuthors.length} {uniqueAuthors.length === 1 ? 'person' : 'people'} replied
                      </span>
                      <span className="text-muted-foreground/60">•</span>
                      <span className="text-muted-foreground/80">{latestReplyTime}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReply();
                      }}
                      className="h-6 px-2 text-xs hover:bg-primary/10"
                    >
                      <Reply className="h-3 w-3 mr-1" />
                      Reply
                    </Button>
                    
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Latest Reply Preview (when collapsed) */}
                {!isExpanded && latestReply && (
                  <div className="pl-2 border-l-2 border-primary/20">
                    <div className="flex items-start space-x-2">
                      <AuthorAvatar pubkey={latestReply.pubkey} size="xs" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1">
                          <span className="font-medium text-sm truncate">{latestReplyName}</span>
                          <span className="text-xs text-muted-foreground">{latestReplyTime}</span>
                        </div>
                        <div className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          <NoteContent event={latestReply} className="text-sm" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </CollapsibleTrigger>

          {/* Expanded Thread View */}
          <CollapsibleContent>
            <div className="border-t border-border/50 bg-accent/5">
              <div className="p-3 space-y-3">
                {replies.map((reply) => (
                  <Comment
                    key={reply.id}
                    root={root}
                    comment={reply}
                    depth={1}
                  />
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}

// Helper component for author avatars
interface AuthorAvatarProps {
  pubkey: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}

function AuthorAvatar({ pubkey, className, size = 'sm' }: AuthorAvatarProps) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name ?? genUserName(pubkey);

  const sizeClasses = {
    xs: 'h-4 w-4',
    sm: 'h-6 w-6',
    md: 'h-8 w-8'
  };

  return (
    <Link to={`/${nip19.npubEncode(pubkey)}`}>
      <Avatar className={cn(
        sizeClasses[size],
        "hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer",
        className
      )}>
        <AvatarImage src={metadata?.picture} />
        <AvatarFallback className="text-xs">
          {displayName.charAt(0)}
        </AvatarFallback>
      </Avatar>
    </Link>
  );
}
