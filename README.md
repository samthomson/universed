# Universes

> Explore infinite universes of communities, conversations, and connections on the decentralized web

Universes is a modern Nostr client that brings Discord-like community features to the decentralized Nostr protocol. Built with React, TypeScript, and cutting-edge web technologies, it offers a rich social experience with chat, marketplace, resources, and more.

## ✨ Features

### 🌐 **Decentralized Communities**
- Create and join communities with organized channels
- Discord-like interface with familiar UX patterns
- Real-time messaging and conversations
- Thread support for organized discussions

### 💬 **Advanced Chat System**
- Real-time messaging with typing indicators
- Message reactions and emoji support
- File uploads via Blossom servers
- Message threading and replies
- Pinned messages
- Context menus for message actions

### 🛒 **Marketplace**
- Buy and sell items with Bitcoin/Lightning
- Community-specific marketplaces
- Secure peer-to-peer transactions
- Rich product listings with media

### 📚 **Resource Sharing**
- Organize and share valuable content
- Folder-based resource management
- Community resource libraries
- Link sharing and previews

### 👥 **Social Features**
- User profiles with rich metadata
- Friend systems and social connections
- Direct messaging with NIP-44 encryption
- User status indicators
- Notification center

### 🛡️ **Moderation & Safety**
- Comprehensive moderation tools
- Admin panels and permissions
- Content reporting system
- Bulk moderation actions
- Auto-moderation settings
- Moderation logs and analytics

### 🔐 **Privacy & Security**
- NIP-44 encrypted direct messages
- Multiple account support
- Secure key management
- Privacy-focused design

### 🎨 **Modern UI/UX**
- Beautiful dark/light theme system
- Responsive design for all devices
- Smooth animations and transitions
- Accessible components with Radix UI
- Professional Discord-inspired interface

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A Nostr identity (created automatically if needed)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd universes
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

### Running Tests

```bash
npm test
```

## 🏗️ Technology Stack

### Core Technologies
- **React 18** - Modern React with hooks and concurrent features
- **TypeScript** - Type-safe JavaScript development
- **Vite** - Fast build tool and development server
- **TailwindCSS 3** - Utility-first CSS framework

### UI Components
- **shadcn/ui** - Beautiful, accessible components built on Radix UI
- **Radix UI** - Low-level UI primitives for accessibility
- **Lucide React** - Beautiful icon library
- **Sonner** - Toast notifications

### Nostr Integration
- **Nostrify** - Modern Nostr framework for web applications
- **nostr-tools** - Core Nostr protocol utilities
- **NIP-44** - Encrypted direct messaging
- **NIP-19** - Bech32-encoded identifiers

### State Management
- **TanStack Query** - Powerful data fetching and caching
- **React Context** - Global app state management
- **Local Storage** - Persistent user preferences

### Development Tools
- **ESLint** - Code linting and quality
- **Vitest** - Fast unit testing
- **Testing Library** - Component testing utilities

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── auth/           # Authentication components
│   ├── chat/           # Chat and messaging
│   ├── comments/       # Comment system
│   ├── community/      # Community management
│   ├── dm/             # Direct messaging
│   ├── layout/         # Layout components
│   ├── moderation/     # Moderation tools
│   ├── spaces/         # Marketplace & resources
│   └── ui/             # shadcn/ui components
├── hooks/              # Custom React hooks
├── pages/              # Page components
├── lib/                # Utility functions
├── contexts/           # React contexts
└── test/               # Testing utilities
```

## 🔧 Configuration

### Relay Configuration

The app connects to Nostr relays for data. Default relay is `wss://relay.nostr.band`, but users can switch between preset relays:

- **Nostr.Band** - General purpose relay
- **Damus** - Popular iOS client relay  
- **Primal** - Caching relay with web client
- **Ditto** - Community-focused relay

### Theme System

Built-in light/dark theme support with system preference detection:

```typescript
import { useTheme } from '@/hooks/useTheme';

const { theme, setTheme } = useTheme();
setTheme('dark' | 'light' | 'system');
```

### Environment Variables

No environment variables required for basic functionality. The app works out-of-the-box with default Nostr relays.

## 🎯 Usage Examples

### Creating a Community

```typescript
import { useNostrPublish } from '@/hooks/useNostrPublish';

const { mutate: createEvent } = useNostrPublish();

// Create a community (NIP-72)
createEvent({
  kind: 34550,
  content: JSON.stringify({
    name: "My Community",
    about: "A place for awesome discussions",
    picture: "https://example.com/image.jpg"
  }),
  tags: [
    ['d', 'my-community-id'],
    ['name', 'My Community'],
    ['about', 'A place for awesome discussions']
  ]
});
```

### Sending a Message

```typescript
import { useNostrPublish } from '@/hooks/useNostrPublish';

const { mutate: createEvent } = useNostrPublish();

// Send a chat message (NIP-28)
createEvent({
  kind: 42,
  content: "Hello, community!",
  tags: [
    ['e', 'community-event-id', '', 'root'],
    ['p', 'recipient-pubkey']
  ]
});
```

### Querying Events

```typescript
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

function useMessages(communityId: string) {
  const { nostr } = useNostr();
  
  return useQuery({
    queryKey: ['messages', communityId],
    queryFn: async ({ signal }) => {
      const events = await nostr.query([{
        kinds: [42],
        '#e': [communityId],
        limit: 50
      }], { signal });
      
      return events;
    }
  });
}
```

## 🔌 Nostr Protocol Features

### Supported NIPs (Nostr Implementation Possibilities)

- **NIP-01** - Basic protocol flow
- **NIP-02** - Contact lists and petnames  
- **NIP-04** - Encrypted direct messages (legacy)
- **NIP-05** - DNS-based verification
- **NIP-07** - Browser extension signing
- **NIP-10** - Text note references and threading
- **NIP-19** - Bech32-encoded identifiers
- **NIP-22** - Comment threads
- **NIP-28** - Public chat channels
- **NIP-44** - Encrypted direct messages (modern)
- **NIP-57** - Lightning zaps
- **NIP-72** - Moderated communities
- **NIP-94** - File metadata

### Custom Event Kinds

The app may use custom event kinds for specific features. See `NIP.md` (if present) for documentation of any custom protocol extensions.

## 🧪 Testing

The project includes comprehensive testing setup:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Testing Components

```typescript
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { MyComponent } from './MyComponent';

test('renders correctly', () => {
  render(
    <TestApp>
      <MyComponent />
    </TestApp>
  );
  
  expect(screen.getByText('Expected text')).toBeInTheDocument();
});
```

## 🚀 Deployment

### GitHub Pages

```bash
npm run build
# Deploy dist/ folder to your hosting provider
```

### Nostr Deploy

```bash
npm run deploy
```

Uses `nostr-deploy-cli` to deploy directly to Nostr relays.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Use existing hooks and components when possible
- Write tests for new features
- Follow the established code style
- Update documentation for new features

## 📝 License

This project is open source. See the LICENSE file for details.

## 🙏 Acknowledgments

- **Nostr Protocol** - Decentralized social networking protocol
- **shadcn/ui** - Beautiful component library
- **Nostrify** - Modern Nostr framework
- **MKStack** - Development framework

---

**Vibed with [MKStack](https://soapbox.pub/mkstack)** ⚡

## 📞 Support

- **Documentation**: Check the `/src` folder for detailed component documentation
- **Issues**: Report bugs and feature requests via GitHub Issues
- **Community**: Join Nostr communities to connect with other users
- **Protocol**: Learn more about Nostr at [nostr.com](https://nostr.com)

---

*Explore infinite universes of communities, conversations, and connections on the decentralized web.* 🌌