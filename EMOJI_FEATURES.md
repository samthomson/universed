# Emoji Features Implementation

This document describes the comprehensive emoji features implemented in the application, including emoji picker, reactions, and text processing utilities.

## Features Overview

### 1. Full Emoji Picker
- **Component**: `EmojiPickerComponent` (`src/components/ui/emoji-picker.tsx`)
- **Library**: `emoji-picker-react` with full Unicode emoji support
- **Features**:
  - Complete emoji catalog with categories
  - Search functionality
  - Skin tone variations
  - Recent emojis
  - Dark theme integration
  - Customizable trigger and positioning

### 2. Emoji Reactions
- **Component**: `MessageReactions` (`src/components/chat/MessageReactions.tsx`)
- **Hook**: `useEmojiReactions` (`src/hooks/useEmojiReactions.ts`)
- **Features**:
  - Add reactions to any message
  - Visual feedback for user's own reactions
  - Reaction counts
  - Full emoji picker for reaction selection
  - Consistent dark theme styling

### 3. Message Compose Integration
- **Components**: 
  - `MessageInput` (main chat)
  - `ThreadReplyInput` (thread replies)
  - `DMMessageInput` (direct messages)
- **Features**:
  - Emoji picker button in all compose areas
  - Cursor position preservation when inserting emojis
  - Auto-resize text areas after emoji insertion

### 4. Text Processing Utilities
- **File**: `src/lib/emoji.ts`
- **Functions**:
  - `extractEmojis()` - Extract all emojis from text
  - `isOnlyEmojis()` - Check if text contains only emojis
  - `countEmojis()` - Count emojis in text
  - `replaceShortcodes()` - Convert text shortcuts to emojis
  - `getEmojiVariants()` - Get skin tone variants
  - `canHaveSkinTone()` - Check if emoji supports skin tones

## Implementation Details

### Emoji Picker Component

```tsx
import { EmojiPickerComponent } from '@/components/ui/emoji-picker';

<EmojiPickerComponent
  onEmojiSelect={(emoji) => console.log(emoji)}
  trigger={<Button>😊</Button>}
  side="top"
  align="end"
/>
```

**Props**:
- `onEmojiSelect`: Callback when emoji is selected
- `trigger`: Custom trigger element (optional)
- `className`: Additional CSS classes
- `side`: Popover position ('top' | 'right' | 'bottom' | 'left')
- `align`: Popover alignment ('start' | 'center' | 'end')

### Emoji Reactions

```tsx
import { MessageReactions } from '@/components/chat/MessageReactions';

<MessageReactions message={nostrEvent} />
```

**Features**:
- Automatically groups reactions by emoji
- Shows reaction counts
- Highlights user's own reactions
- Provides emoji picker for adding new reactions
- Handles reaction toggling (add/remove)

### Text Processing

```tsx
import { extractEmojis, replaceShortcodes } from '@/lib/emoji';

const text = "Hello :) <3 :fire:";
const processed = replaceShortcodes(text); // "Hello 😊 ❤️ 🔥"
const emojis = extractEmojis(processed); // ["😊", "❤️", "🔥"]
```

## Supported Shortcodes

The application supports common text shortcuts that are automatically converted to emojis:

| Shortcode | Emoji | Description |
|-----------|-------|-------------|
| `:)` | 😊 | Smile |
| `:-(` | 😢 | Sad |
| `:D` | 😃 | Grin |
| `;)` | 😉 | Wink |
| `<3` | ❤️ | Heart |
| `</3` | 💔 | Broken heart |
| `:thumbsup:` | 👍 | Thumbs up |
| `:fire:` | 🔥 | Fire |
| `:100:` | 💯 | Hundred |
| `:thinking:` | 🤔 | Thinking |

## Nostr Integration

### Reaction Events (Kind 7)

Emoji reactions are stored as Nostr events with kind 7:

```json
{
  "kind": 7,
  "content": "👍",
  "tags": [
    ["e", "event_id_being_reacted_to"],
    ["p", "author_pubkey_of_original_event"],
    ["k", "kind_of_original_event"]
  ]
}
```

### Message Events with Emojis

Regular messages (kind 1, 9411) can contain emojis in their content:

```json
{
  "kind": 1,
  "content": "Hello world! 👋 This is awesome! 🔥",
  "tags": []
}
```

## Styling and Theme

All emoji components follow the application's dark theme:

- **Emoji Picker**: Dark theme with gray-800 background
- **Reaction Buttons**: Dark hover states (`hover:bg-gray-600`)
- **Selected Reactions**: Dark background (`bg-gray-800/80`)
- **Compose Buttons**: Consistent with other UI elements

## Performance Considerations

1. **Lazy Loading**: Emoji picker uses lazy loading for better performance
2. **Debounced Search**: Search in emoji picker is optimized
3. **Efficient Rendering**: Only renders visible emojis in large lists
4. **Memory Management**: Proper cleanup of event listeners

## Browser Support

- **Modern Browsers**: Full support for all features
- **Emoji Rendering**: Uses system emoji fonts for best compatibility
- **Fallbacks**: Graceful degradation for older browsers

## Usage Examples

### Basic Emoji Picker

```tsx
function MyComponent() {
  const [text, setText] = useState('');

  const handleEmojiSelect = (emoji: string) => {
    setText(prev => prev + emoji);
  };

  return (
    <div>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <EmojiPickerComponent onEmojiSelect={handleEmojiSelect} />
    </div>
  );
}
```

### Custom Reaction System

```tsx
function CustomReactions({ message }: { message: NostrEvent }) {
  const { addReaction } = useEmojiReactions();

  const quickReactions = ['👍', '❤️', '😂', '🔥'];

  return (
    <div className="flex gap-1">
      {quickReactions.map(emoji => (
        <Button
          key={emoji}
          onClick={() => addReaction({ targetEvent: message, emoji })}
        >
          {emoji}
        </Button>
      ))}
    </div>
  );
}
```

### Text Processing

```tsx
function MessageDisplay({ content }: { content: string }) {
  const processedContent = replaceShortcodes(content);
  const isEmojiOnly = isOnlyEmojis(processedContent);

  return (
    <div className={isEmojiOnly ? 'text-4xl' : 'text-base'}>
      {processedContent}
    </div>
  );
}
```

## Testing

The emoji features include comprehensive testing:

- Unit tests for utility functions
- Component tests for emoji picker
- Integration tests for reaction system
- E2E tests for complete workflows

## Dependencies

- `emoji-picker-react`: Full-featured emoji picker component
- `emoji-regex`: Unicode emoji detection and extraction
- `@nostrify/nostrify`: Nostr protocol integration
- `@tanstack/react-query`: State management for reactions

## Future Enhancements

1. **Custom Emoji**: Support for custom server emojis
2. **Emoji Analytics**: Track popular emojis and reactions
3. **Animated Emojis**: Support for animated emoji formats
4. **Emoji Suggestions**: AI-powered emoji suggestions based on text
5. **Bulk Reactions**: Select multiple emojis at once
6. **Reaction Notifications**: Notify users when their content is reacted to