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
      className={cn("w-8 h-8 text-gray-400 hover:text-gray-300 hover:bg-gray-800/60", className)}
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
        className="w-auto p-0 border-gray-600 bg-gray-800"
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
          theme={Theme.DARK}
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