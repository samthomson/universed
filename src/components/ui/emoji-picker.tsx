import { useState } from 'react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmojiPickerComponentProps {
  onEmojiSelect: (emoji: string) => void;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

export function EmojiPickerComponent({
  onEmojiSelect,
  onOpenChange,
  trigger,
  className,
  side = 'top',
  align = 'end'
}: EmojiPickerComponentProps) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    setOpen(false);
    onOpenChange?.(false);
  };

  const defaultTrigger = (
    <Button
      variant="ghost"
      size="icon"
      className={cn("w-8 h-8 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-purple-100 dark:hover:bg-purple-900/20 rounded-full", className)}
    >
      <Smile className="w-5 h-5" />
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {trigger || defaultTrigger}
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-800 shadow-sm rounded-xl"
        side={side}
        align={align}
        sideOffset={0}
        collisionPadding={8}
        onPointerDownOutside={(e) => {
          // Prevent closing when clicking on the trigger button
          const target = e.currentTarget as HTMLElement | null;
          const trigger = target?.previousElementSibling as HTMLElement | null;
          if (trigger && e.target instanceof Node && trigger.contains(e.target)) {
            e.preventDefault();
          }
        }}
      >
        <EmojiPicker
          onEmojiClick={handleEmojiClick}
          theme={Theme.AUTO}
          width={350}
          height={400}
          searchDisabled={false}
          skinTonesDisabled={false}
          previewConfig={{
            defaultEmoji: "1f60a",
            defaultCaption: "Choose an emoji",
            showPreview: true
          }}
          lazyLoadEmojis={true}
        />
      </PopoverContent>
    </Popover>
  );
}