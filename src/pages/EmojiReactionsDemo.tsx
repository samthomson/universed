import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmojiPickerComponent } from '@/components/ui/emoji-picker';
import { MessageReactions } from '@/components/chat/MessageReactions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useEmojiReactions } from '@/hooks/useEmojiReactions';
import { LoginArea } from '@/components/auth/LoginArea';
import { Smile, MessageSquare, Heart, ThumbsUp } from 'lucide-react';
import type { NostrEvent } from '@nostrify/nostrify';

// Mock message data for demonstration
const mockMessages: NostrEvent[] = [
  {
    id: 'demo-message-1',
    pubkey: '82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2',
    created_at: Math.floor(Date.now() / 1000) - 3600,
    kind: 1,
    content: 'Hey everyone! Just wanted to share this amazing sunset I captured today 🌅 What do you think?',
    tags: [],
    sig: 'demo-sig-1'
  },
  {
    id: 'demo-message-2',
    pubkey: '82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2',
    created_at: Math.floor(Date.now() / 1000) - 1800,
    kind: 1,
    content: 'Working on some new features for our Nostr client. Emoji reactions are now fully functional! 🎉',
    tags: [],
    sig: 'demo-sig-2'
  },
  {
    id: 'demo-message-3',
    pubkey: '82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2',
    created_at: Math.floor(Date.now() / 1000) - 900,
    kind: 1,
    content: 'Anyone else excited about the future of decentralized social media? The possibilities are endless! 🚀',
    tags: [],
    sig: 'demo-sig-3'
  }
];

function DemoMessage({ message }: { message: NostrEvent }) {
  const { user } = useCurrentUser();
  const { addReaction } = useEmojiReactions();
  const [isHovered, setIsHovered] = useState(false);

  const handleEmojiSelect = (emoji: string) => {
    if (!user) return;
    addReaction({
      targetEvent: message,
      emoji,
    });
  };

  const handleQuickReaction = (emoji: string) => {
    if (!user) return;
    addReaction({
      targetEvent: message,
      emoji,
    });
  };

  return (
    <Card 
      className="mb-4 transition-all duration-200 hover:shadow-md"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-4">
        <div className="flex space-x-3">
          {/* Avatar */}
          <Avatar className="w-10 h-10">
            <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face" />
            <AvatarFallback className="bg-indigo-600 text-white">
              DU
            </AvatarFallback>
          </Avatar>

          {/* Message Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline space-x-2 mb-1">
              <span className="font-semibold text-foreground">Demo User</span>
              <span className="text-xs text-muted-foreground">
                {new Date(message.created_at * 1000).toLocaleTimeString()}
              </span>
            </div>

            <div className="text-sm text-foreground mb-2">
              {message.content}
            </div>

            {/* Reactions */}
            <MessageReactions message={message} />

            {/* Quick Reaction Buttons */}
            {isHovered && (
              <div className="flex items-center space-x-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => handleQuickReaction('👍')}
                >
                  <ThumbsUp className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => handleQuickReaction('❤️')}
                >
                  <Heart className="w-3 h-3" />
                </Button>
                <EmojiPickerComponent
                  onEmojiSelect={handleEmojiSelect}
                  trigger={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                    >
                      <Smile className="w-3 h-3" />
                    </Button>
                  }
                  side="top"
                  align="start"
                />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmojiReactionsDemo() {
  const { user } = useCurrentUser();

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="w-6 h-6" />
            <span>Emoji Reactions Demo</span>
          </CardTitle>
          <CardDescription>
            Experience the full emoji reaction system in action. React to messages with any emoji using the picker or quick reaction buttons.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!user ? (
            <div className="text-center py-8">
              <div className="mb-4">
                <Smile className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">
                  Please log in to try emoji reactions
                </p>
              </div>
              <LoginArea className="max-w-60 mx-auto" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-6">
                <Badge variant="secondary">Logged in as {user.pubkey.slice(0, 8)}...</Badge>
                <span className="text-sm text-muted-foreground">
                  Hover over messages to see reaction options
                </span>
              </div>

              {/* Demo Messages */}
              <div className="space-y-4">
                {mockMessages.map((message) => (
                  <DemoMessage key={message.id} message={message} />
                ))}
              </div>

              {/* Features List */}
              <Card className="mt-8">
                <CardHeader>
                  <CardTitle className="text-lg">Features Demonstrated</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <h4 className="font-semibold">✨ Emoji Picker</h4>
                      <p className="text-muted-foreground">
                        Full emoji picker with search, categories, and skin tone support
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold">⚡ Quick Reactions</h4>
                      <p className="text-muted-foreground">
                        One-click reactions with thumbs up and heart buttons
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold">📊 Reaction Counts</h4>
                      <p className="text-muted-foreground">
                        Real-time reaction counts with user participation indicators
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold">🔄 Toggle Support</h4>
                      <p className="text-muted-foreground">
                        Click existing reactions to toggle them on/off
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}