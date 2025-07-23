import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EmojiPickerComponent } from '@/components/ui/emoji-picker';
import { extractEmojis, isOnlyEmojis, countEmojis, replaceShortcodes } from '@/lib/emoji';
import { Smile, Heart, ThumbsUp, Laugh, Angry, Frown } from 'lucide-react';

export function EmojiDemo() {
  const [text, setText] = useState('Hello world! :) <3 :fire:');
  const [reactions, setReactions] = useState<Record<string, number>>({
    '👍': 5,
    '❤️': 3,
    '😂': 2,
    '🔥': 1,
  });

  const handleEmojiSelect = (emoji: string) => {
    setText(prev => prev + emoji);
  };

  const handleReaction = (emoji: string) => {
    setReactions(prev => ({
      ...prev,
      [emoji]: (prev[emoji] || 0) + 1,
    }));
  };

  const processedText = replaceShortcodes(text);
  const extractedEmojis = extractEmojis(processedText);
  const emojiCount = countEmojis(processedText);
  const onlyEmojis = isOnlyEmojis(processedText);

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Emoji Features Demo</CardTitle>
          <CardDescription>
            Comprehensive emoji support including picker, reactions, and text processing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Emoji Picker Demo */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Emoji Picker</h3>
            <div className="flex items-center space-x-2">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message with emojis..."
                className="flex-1"
              />
              <EmojiPickerComponent
                onEmojiSelect={handleEmojiSelect}
                trigger={
                  <Button variant="outline" size="icon">
                    <Smile className="w-4 h-4" />
                  </Button>
                }
              />
            </div>
            <div className="text-sm text-gray-600">
              <p><strong>Original:</strong> {text}</p>
              <p><strong>Processed:</strong> {processedText}</p>
            </div>
          </div>

          {/* Text Analysis */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Text Analysis</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p><strong>Extracted Emojis:</strong> {extractedEmojis.join(' ') || 'None'}</p>
                <p><strong>Emoji Count:</strong> {emojiCount}</p>
              </div>
              <div>
                <p><strong>Only Emojis:</strong> {onlyEmojis ? 'Yes' : 'No'}</p>
                <p><strong>Has Text:</strong> {!onlyEmojis ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>

          {/* Reaction Demo */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Emoji Reactions</h3>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="mb-3">Sample message content here...</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(reactions).map(([emoji, count]) => (
                  <Button
                    key={emoji}
                    variant="outline"
                    size="sm"
                    className="h-8 px-3"
                    onClick={() => handleReaction(emoji)}
                  >
                    <span className="mr-1">{emoji}</span>
                    <span className="text-xs">{count}</span>
                  </Button>
                ))}

                {/* Quick reaction buttons */}
                <EmojiPickerComponent
                  onEmojiSelect={handleReaction}
                  trigger={
                    <Button variant="outline" size="sm" className="h-8 px-2">
                      <Smile className="w-3 h-3" />
                    </Button>
                  }
                  side="top"
                />
              </div>
            </div>
          </div>

          {/* Quick Reactions */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Quick Reactions</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { emoji: '👍', icon: ThumbsUp, label: 'Like' },
                { emoji: '❤️', icon: Heart, label: 'Love' },
                { emoji: '😂', icon: Laugh, label: 'Laugh' },
                { emoji: '😢', icon: Frown, label: 'Sad' },
                { emoji: '😡', icon: Angry, label: 'Angry' },
              ].map(({ emoji, icon: Icon, label }) => (
                <Button
                  key={emoji}
                  variant="outline"
                  size="sm"
                  onClick={() => handleReaction(emoji)}
                  className="flex items-center space-x-1"
                >
                  <Icon className="w-3 h-3" />
                  <span>{emoji}</span>
                  <span className="text-xs">{label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Shortcode Examples */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Shortcode Support</h3>
            <div className="text-sm space-y-1">
              <p><code>:)</code> → 😊</p>
              <p><code>&lt;3</code> → ❤️</p>
              <p><code>:fire:</code> → 🔥</p>
              <p><code>:100:</code> → 💯</p>
              <p><code>:thumbsup:</code> → 👍</p>
              <p><code>:thinking:</code> → 🤔</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}