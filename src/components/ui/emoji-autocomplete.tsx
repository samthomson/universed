import { useEffect, useRef, useState } from 'react';
import { searchEmojis, type EmojiData } from '@/lib/emojiUtils';
import { cn } from '@/lib/utils';

interface EmojiAutocompleteProps {
  query: string;
  selectedIndex: number;
  onSelect: (emoji: EmojiData) => void;
  className?: string;
}

export function EmojiAutocomplete({
  query,
  selectedIndex,
  onSelect,
  className,
}: EmojiAutocompleteProps) {
  const [emojis, setEmojis] = useState<EmojiData[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search for emojis based on query
  useEffect(() => {
    const results = searchEmojis(query, 8);
    setEmojis(results);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const container = containerRef.current;
    if (container && selectedIndex < emojis.length) {
      const selectedElement = container.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [selectedIndex, emojis]);

  if (emojis.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        'absolute bottom-full left-0 z-50 mb-2',
        'min-w-[200px] max-w-[300px] max-h-[200px] overflow-y-auto',
        'bg-popover border border-border rounded-md shadow-lg',
        'py-1',
        className
      )}
    >
      {emojis.map((emoji, index) => (
        <div
          key={emoji.emoji}
          className={cn(
            'flex items-center gap-2 px-3 py-2 cursor-pointer text-sm',
            'hover:bg-accent hover:text-accent-foreground',
            index === selectedIndex && 'bg-accent text-accent-foreground'
          )}
          onClick={() => onSelect(emoji)}
        >
          <span className="text-lg">{emoji.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">:{emoji.shortcodes[0]}:</div>
            {emoji.shortcodes.length > 1 && (
              <div className="text-xs text-muted-foreground truncate">
                {emoji.shortcodes
                  .slice(1, 3)
                  .map(name => `:${name}:`)
                  .join(', ')}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}