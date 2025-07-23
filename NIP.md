# NostrCord Protocol Extensions\n\n`draft` `optional`\n\nThis document describes the NostrCord platform's extensions to existing Nostr NIPs that enhance community management, user interaction, and social features for a Discord-like experience on Nostr.\n\n## Background\n\nNostrCord builds upon several existing NIPs to create a comprehensive Discord-like platform:\n- **NIP-72**: Community definition and moderation (kinds 34550, 4550)\n- **NIP-02**: Contact lists for friend management (kind 3)\n- **NIP-04/44**: Encrypted direct messages (kind 4)\n- **NIP-25**: Reactions (kind 7)\n- **NIP-51**: User lists for blocking/muting (kind 30000)\n- **NIP-09**: Event deletion (kind 5)\n\n## Core Event Kinds\n\n### Kind 32603: Channel Folder Definition
**Addressable event** for organizing channels into folders within communities.

**Tags:**
- `["d", communityId:folderId]` - Unique identifier combining community and folder name (required)
- `["a", communityId]` - Reference to the parent community (required)
- `["name", folderName]` - Folder name (required)
- `["description", description]` - Folder description (optional)
- `["position", position]` - Folder position for ordering (required)
- `["t", "channel-folder"]` - Tag for filtering folder events (required)

**Content:** JSON object with folder metadata
```json
{
  "name": "Development",
  "description": "Channels for development discussions",
  "position": 0
}
```

**Example:**
```json
{
  "kind": 32603,
  "pubkey": "moderator_pubkey",
  "created_at": 1234567890,
  "tags": [
    ["d", "34550:community_creator_pubkey:bitcoin-discussion:development"],
    ["a", "34550:community_creator_pubkey:bitcoin-discussion"],
    ["name", "Development"],
    ["description", "Channels for development discussions"],
    ["position", "0"],
    ["t", "channel-folder"]
  ],
  "content": "{\"name\":\"Development\",\"description\":\"Channels for development discussions\",\"position\":0}"
}
```

### Kind 39923: Channel Permissions
**Addressable event** for defining read and write permissions for specific channels.

**Tags:**
- `["d", communityId:channelId]` - Unique identifier combining community and channel (required)
- `["a", communityId]` - Reference to the parent community (required)
- `["channel", channelId]` - Reference to the specific channel (required)
- `["p", pubkey, "", "read-allow"]` - Users allowed to read (for specific permissions)
- `["p", pubkey, "", "write-allow"]` - Users allowed to write (for specific permissions)
- `["p", pubkey, "", "read-deny"]` - Users explicitly denied read access
- `["p", pubkey, "", "write-deny"]` - Users explicitly denied write access
- `["t", "channel-permissions"]` - Tag for filtering permission events (required)

**Content:** JSON object with permission settings
```json
{
  "readPermissions": "members",
  "writePermissions": "moderators"
}
```

**Permission Levels:**
- `"everyone"` - All users can access
- `"members"` - Only community members can access
- `"moderators"` - Only moderators and admins can access
- `"specific"` - Only users listed in allow tags can access

**Example:**
```json
{
  "kind": 39923,
  "pubkey": "moderator_pubkey",
  "created_at": 1234567890,
  "tags": [
    ["d", "34550:community_creator_pubkey:bitcoin-discussion:announcements"],
    ["a", "34550:community_creator_pubkey:bitcoin-discussion"],
    ["channel", "announcements"],
    ["p", "user1_pubkey", "", "read-allow"],
    ["p", "user2_pubkey", "", "write-allow"],
    ["t", "channel-permissions"]
  ],
  "content": "{\"readPermissions\":\"specific\",\"writePermissions\":\"specific\"}"
}
```

### Kind 32807: Channel Definition
**Addressable event** for defining channels within communities.

**Tags:**
- `["d", communityId:channelName]` - Unique identifier combining community and channel name (required)
- `["a", communityId]` - Reference to the parent community (required)
- `["name", channelName]` - Channel name (required)
- `["description", description]` - Channel description (optional)
- `["channel_type", type]` - Channel type: "text" or "voice" (required)
- `["folder", folderId]` - Reference to parent folder (optional)
- `["position", position]` - Channel position for ordering (required)
- `["t", "channel"]` - Tag for filtering channel events (required)

**Content:** JSON object with channel metadata
```json
{
  "name": "general",
  "description": "General discussion for the community",
  "type": "text",
  "folderId": "development",
  "position": 0
}
```

**Example:**
```json
{
  "kind": 32807,
  "pubkey": "moderator_pubkey",
  "created_at": 1234567890,
  "tags": [
    ["d", "34550:community_creator_pubkey:bitcoin-discussion:general"],
    ["a", "34550:community_creator_pubkey:bitcoin-discussion"],
    ["name", "general"],
    ["description", "General discussion for the community"],
    ["channel_type", "text"],
    ["folder", "development"],
    ["position", "0"],
    ["t", "channel"]
  ],
  "content": "{\"name\":\"general\",\"description\":\"General discussion for the community\",\"type\":\"text\",\"folderId\":\"development\",\"position\":0}"
}
```

**Permission Requirements:**
- Only community creators and moderators can create, update, and delete channels
- Only community creators and moderators can create, update, and delete channel folders
- Only community creators and moderators can modify channel permissions
- Channel names must be unique within a community
- Channel names are normalized to lowercase with special characters replaced by hyphens
- The "general" channel is always present as a default text channel
- Reserved channel names (like "general") cannot be used for custom channels
- Channels can be organized into folders for better organization
- Folder positions and channel positions determine display order

### Kind 9411: Channel Chat Message\n**Regular event** for chat messages within community channels.\n\n**Tags:**\n- `[\"t\", channelId]` - Channel identifier (required)\n- `[\"a\", communityId]` - Community reference (optional but recommended)\n- `[\"e\", parentEventId]` - Reply to another message (optional)\n- `[\"p\", mentionedPubkey]` - Mentioned users (optional, multiple allowed)\n\n**Example:**\n```json\n{\n  \"kind\": 9411,\n  \"pubkey\": \"user_pubkey\",\n  \"created_at\": 1234567890,\n  \"tags\": [\n    [\"t\", \"general\"],\n    [\"a\", \"34550:community_creator_pubkey:bitcoin-discussion\"]\n  ],\n  \"content\": \"Hello everyone! Great to be here.\"\n}\n```\n\n**Reply Example:**\n```json\n{\n  \"kind\": 9411,\n  \"pubkey\": \"replying_user_pubkey\",\n  \"created_at\": 1234567891,\n  \"tags\": [\n    [\"t\", \"general\"],\n    [\"a\", \"34550:community_creator_pubkey:bitcoin-discussion\"],\n    [\"e\", \"parent_message_id\"],\n    [\"p\", \"parent_message_author_pubkey\"]\n  ],\n  \"content\": \"Thanks for the welcome!\"\n}\n```\n\n### Kind 30315: User Status\n**Addressable event** for user presence and custom status messages.\n\n**Tags:**\n- `[\"d\", \"status\"]` - Addressable event identifier\n- `[\"status\", statusValue]` - Status: \"online\", \"away\", \"busy\", \"offline\"\n- `[\"message\", customMessage]` - Custom status message (optional)\n\n**Example:**\n```json\n{\n  \"kind\": 30315,\n  \"pubkey\": \"user_pubkey\",\n  \"created_at\": 1234567890,\n  \"tags\": [\n    [\"d\", \"status\"],\n    [\"status\", \"busy\"],\n    [\"message\", \"Working on NostrCord features\"]\n  ],\n  \"content\": \"\"\n}\n```\n\n### Kind 30078: Typing Indicator\n**Ephemeral addressable event** for real-time typing indicators.\n\n**Tags:**\n- `[\"d\", uniqueId]` - Unique identifier for this typing session\n- `[\"t\", channelId]` - Channel where user is typing\n\n**Example:**\n```json\n{\n  \"kind\": 30078,\n  \"pubkey\": \"user_pubkey\",\n  \"created_at\": 1234567890,\n  \"tags\": [\n    [\"d\", \"typing-general-1234567890\"],\n    [\"t\", \"general\"]\n  ],\n  \"content\": \"\"\n}\n```\n\n### Kind 30000: Notification Preferences\n**Addressable event** for user notification settings (extends NIP-51).\n\n**Tags:**\n- `[\"d\", \"notification-preferences\"]` - Identifier\n\n**Content:** JSON object with notification preferences\n```json\n{\n  \"mentions\": true,\n  \"directMessages\": true,\n  \"communityMessages\": false,\n  \"reactions\": true,\n  \"replies\": true,\n  \"friendRequests\": true,\n  \"desktopNotifications\": true,\n  \"soundEnabled\": true\n}\n```\n\n## Community Management Extensions (Following Chorus NIP)\n\n### Kind 34551: Approved Members List\n**Addressable event** that maintains a list of users who are pre-approved to post in the community without requiring individual post approvals.\n\n**Tags:**\n- `[\"d\", communityId]` - Identifies which community this list belongs to\n- `[\"p\", pubkey]` - One tag per approved member\n\n**Example:**\n```json\n{\n  \"kind\": 34551,\n  \"pubkey\": \"moderator_pubkey\",\n  \"created_at\": 1234567890,\n  \"tags\": [\n    [\"d\", \"34550:community_creator_pubkey:bitcoin-discussion\"],\n    [\"p\", \"approved_user_1_pubkey\"],\n    [\"p\", \"approved_user_2_pubkey\"],\n    [\"p\", \"approved_user_3_pubkey\"]\n  ],\n  \"content\": \"\"\n}\n```\n\n### Kind 34552: Declined Members List\n**Addressable event** that tracks users whose join requests have been declined.\n\n**Tags:**\n- `[\"d\", communityId]` - Identifies which community this list belongs to\n- `[\"p\", pubkey]` - One tag per declined user\n\n### Kind 34553: Banned Members List\n**Addressable event** that maintains a list of users who are banned from the community.\n\n**Tags:**\n- `[\"d\", communityId]` - Identifies which community this list belongs to\n- `[\"p\", pubkey]` - One tag per banned user\n\n### Kind 34554: Pinned Messages List\n**Addressable event** that maintains a list of messages pinned by community moderators.\n\n**Tags:**\n- `[\"d\", communityId]` - Identifies which community this list belongs to\n- `[\"e\", eventId]` - One tag per pinned message\n\n**Example:**\n```json\n{\n  \"kind\": 34554,\n  \"pubkey\": \"moderator_pubkey\",\n  \"created_at\": 1234567890,\n  \"tags\": [\n    [\"d\", \"34550:community_creator_pubkey:bitcoin-discussion\"],\n    [\"e\", \"pinned_message_1_id\"],\n    [\"e\", \"pinned_message_2_id\"]\n  ],\n  \"content\": \"\"\n}\n```\n\n### Kind 4552: Join Request\n**Regular event** that represents a user's request to join a community.\n\n**Tags:**\n- `[\"a\", communityId]` - References the target community\n\n**Example:**\n```json\n{\n  \"kind\": 4552,\n  \"pubkey\": \"requesting_user_pubkey\",\n  \"created_at\": 1234567890,\n  \"tags\": [\n    [\"a\", \"34550:community_creator_pubkey:bitcoin-discussion\"]\n  ],\n  \"content\": \"I would like to join this community to discuss Bitcoin topics.\"\n}\n```\n\n### Kind 4553: Leave Request\n**Regular event** that represents a user's request to leave a community.\n\n**Tags:**\n- `[\"a\", communityId]` - References the target community\n\n## User Lists (NIP-51 Extensions)\n\n### Kind 30000: Blocked Users List\n**Addressable event** for managing blocked users.\n\n**Tags:**\n- `[\"d\", \"blocked\"]` - Identifier for blocked users list\n- `[\"p\", pubkey]` - One tag per blocked user\n\n### Kind 30000: Muted Users List\n**Addressable event** for managing muted users.\n\n**Tags:**\n- `[\"d\", \"muted\"]` - Identifier for muted users list\n- `[\"p\", pubkey]` - One tag per muted user\n\n## Message Actions\n\n### Message Editing\nMessage editing is implemented by creating a new event of the same kind with an additional edit reference tag:\n- `[\"e\", originalEventId, \"\", \"edit\"]` - References the original message being edited\n\n### Message Deletion (NIP-09)\nMessage deletion uses the standard NIP-09 deletion events (kind 5):\n- `[\"e\", messageEventId]` - References the message to delete\n- `[\"k\", messageKind]` - Kind of the original message\n\n## Query Patterns\n\n**Get messages for a specific channel:**\n```json\n{\n  \"kinds\": [9411],\n  \"#t\": [\"channel-name\"],\n  \"limit\": 100\n}\n```\n\n**Get messages for a channel in a specific community:**\n```json\n{\n  \"kinds\": [9411],\n  \"#t\": [\"channel-name\"],\n  \"#a\": [\"34550:creator_pubkey:community_identifier\"],\n  \"limit\": 100\n}\n```\n\n**Get typing indicators for a channel:**\n```json\n{\n  \"kinds\": [30078],\n  \"#t\": [\"channel-name\"],\n  \"since\": 1234567880,\n  \"limit\": 50\n}\n```\n\n**Get user status:**\n```json\n{\n  \"kinds\": [30315],\n  \"authors\": [\"user_pubkey\"],\n  \"#d\": [\"status\"],\n  \"limit\": 1\n}\n```\n\n**Get community member lists:**\n```json\n{\n  \"kinds\": [34551, 34552, 34553],\n  \"#d\": [\"34550:creator_pubkey:community_identifier\"],\n  \"limit\": 10\n}\n```\n\n## Implementation Notes\n\n### Membership Status Determination\n\nA user's membership status in a community is determined by checking the following events in order:\n\n1. **Community Creator**: If the user's pubkey matches the community creator, they are automatically a member with owner privileges\n2. **Moderators**: If the user's pubkey is listed in the community definition with moderator role, they are automatically a member with moderator privileges\n3. **Approved Members List (Kind 34551)**: If the user's pubkey is in the approved members list, they are a member\n4. **Banned Members List (Kind 34553)**: If the user's pubkey is in the banned list, they are banned (overrides other statuses)\n5. **Declined Members List (Kind 34552)**: If the user's pubkey is in the declined list, their membership was declined\n6. **Join Request (Kind 4552)**: If the user has submitted a join request but is not in any other list, their request is pending\n\n### Auto-Approval Workflow\n\nMessages from users in the approved members list (Kind 34551) are automatically considered approved without requiring individual Kind 4550 approval events. This reduces moderation overhead for trusted community members.\n\n### Typing Indicators\n\nTyping indicators (Kind 30078) are ephemeral events that should:\n- Be sent at most once every 2 seconds per channel\n- Be considered expired after 5 seconds\n- Be automatically cleaned up by clients\n- Not be stored permanently by relays\n\n### User Status Updates\n\nUser status events (Kind 30315) should:\n- Be updated when the user's status changes\n- Include a custom message when provided\n- Be used to determine online/offline status in member lists\n- Default to \"offline\" if no recent status event exists\n\n### Message Filtering\n\nClients should:\n- Hide messages from blocked users completely\n- Show muted user messages with reduced opacity or behind a \"Show message\" button\n- Respect community ban lists when displaying messages\n- Filter out deleted messages (referenced by Kind 5 events)\n\n## Security Considerations\n\n- Member lists should only be updated by community moderators or creators\n- Clients should verify moderator permissions before displaying moderation actions\n- Banned user lists should be respected across all community interactions\n- User status updates should be rate-limited to prevent spam\n- Typing indicators should be throttled and automatically expire\n- Message editing should preserve the original event ID in edit references\n\n## Compatibility\n\nThese extensions are designed to be compatible with existing Nostr NIPs. Clients that implement:\n\n- **Basic NIP-72 only**: Will see community definitions and basic functionality\n- **Standard Nostr NIPs**: Will have partial functionality with graceful degradation\n- **NostrCord extensions**: Will have full Discord-like functionality\n\nThe extensions use standard Nostr event patterns and are designed to be interoperable with other Nostr clients while providing enhanced features for the NostrCord platform."

**Get channels for a community:**
```json
{
  "kinds": [32807],
  "#a": ["34550:creator_pubkey:community_identifier"],
  "#t": ["channel"],
  "limit": 100
}
```

**Get channel folders for a community:**
```json
{
  "kinds": [32603],
  "#a": ["34550:creator_pubkey:community_identifier"],
  "#t": ["channel-folder"],
  "limit": 100
}
```

**Get channel permissions:**
```json
{
  "kinds": [39923],
  "#d": ["34550:creator_pubkey:community_identifier:channel_name"],
  "#channel": ["channel_name"],
  "limit": 1
}
```
