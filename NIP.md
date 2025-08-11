# Custom Nostr Protocol Extensions

This document describes custom event kinds and protocol extensions used by this Nostr client application.

## Chorus NIP-72 Extensions

This application implements the Chorus NIP-72 Extensions for moderated communities with enhanced member management, content organization, and moderation features.

### Community Definition (Kind 34550)

**Kind:** 34550 (Addressable Event)
**Purpose:** Define a community with metadata and moderator lists
**Standard:** NIP-72

### Member Management Events

#### Approved Members List (Kind 34551)

**Kind:** 34551 (Addressable Event)
**Purpose:** Maintain a list of users who are pre-approved to post in the community without requiring individual post approvals

**Event Structure:**
```json
{
  "kind": 34551,
  "content": "",
  "tags": [
    ["d", "<community-id>"],
    ["p", "<approved-user-pubkey>"],
    ["p", "<approved-user-pubkey>"],
    ["alt", "Approved members list for <community-id>"]
  ]
}
```

**Tags:**
- **`d`** (required): Community identifier this list belongs to
- **`p`** (multiple): Approved user pubkeys
- **`alt`** (required): Human-readable description per NIP-31

**Behavior:**
- Users in this list can post comments without requiring individual Kind 4550 approval events
- Reduces moderation overhead for trusted community members
- Only community moderators can update this list

#### Declined Members List (Kind 34552)

**Kind:** 34552 (Addressable Event)
**Purpose:** Track users whose join requests have been declined

**Event Structure:**
```json
{
  "kind": 34552,
  "content": "",
  "tags": [
    ["d", "<community-id>"],
    ["p", "<declined-user-pubkey>"],
    ["p", "<declined-user-pubkey>"],
    ["alt", "Declined members list for <community-id>"]
  ]
}
```

**Tags:**
- **`d`** (required): Community identifier this list belongs to
- **`p`** (multiple): Declined user pubkeys
- **`alt`** (required): Human-readable description per NIP-31

#### Banned Members List (Kind 34553)

**Kind:** 34553 (Addressable Event)
**Purpose:** Maintain a list of users who are banned from the community

**Event Structure:**
```json
{
  "kind": 34553,
  "content": "",
  "tags": [
    ["d", "<community-id>"],
    ["p", "<banned-user-pubkey>"],
    ["p", "<banned-user-pubkey>"],
    ["alt", "Banned members list for <community-id>"]
  ]
}
```

**Tags:**
- **`d`** (required): Community identifier this list belongs to
- **`p`** (multiple): Banned user pubkeys
- **`alt`** (required): Human-readable description per NIP-31

**Behavior:**
- Banned users cannot post in the community
- All content from banned users is hidden from community members
- Only community moderators can update this list

### Content Organization Events

#### Pinned Posts List (Kind 34554)

**Kind:** 34554 (Addressable Event)
**Purpose:** Maintain a list of posts pinned by community moderators

**Event Structure:**
```json
{
  "kind": 34554,
  "content": "",
  "tags": [
    ["d", "<community-id>:<channel-id>"],
    ["t", "<channel-id>"],
    ["a", "<community-id>"],
    ["e", "<pinned-post-id>"],
    ["e", "<pinned-post-id>"],
    ["alt", "Pinned posts for <channel-id> in <community-id>"]
  ]
}
```

**Tags:**
- **`d`** (required): Unique identifier combining community ID and channel ID
- **`t`** (required): Channel identifier for filtering
- **`a`** (required): Reference to the community
- **`e`** (multiple): Pinned post event IDs
- **`alt`** (required): Human-readable description per NIP-31

**Behavior:**
- Posts are pinned at the channel level within a community
- Multiple posts can be pinned per channel
- Order is determined by the sequence of `e` tags (most recent first)
- Only community moderators can update pinned posts

#### Pinned Groups List (Kind 34555)

**Kind:** 34555 (Addressable Event)
**Purpose:** Allow users to maintain a personal list of their favorite/pinned communities

**Event Structure:**
```json
{
  "kind": 34555,
  "content": "",
  "tags": [
    ["d", "pinned-groups"],
    ["a", "<community-id>"],
    ["a", "<community-id>"],
    ["alt", "User's pinned communities list"]
  ]
}
```

**Tags:**
- **`d`** (required): Always "pinned-groups" to identify this as the user's pinned groups list
- **`a`** (multiple): Community identifiers for pinned communities
- **`alt`** (required): Human-readable description per NIP-31

**Behavior:**
- Each user maintains their own personal list of pinned communities
- Communities can be pinned/unpinned by the user
- Used for quick access to frequently visited communities

### Moderation Action Events

#### Post Approval (Kind 4550)

**Kind:** 4550 (Regular Event)
**Purpose:** Moderator approval events for comments (extended for Kind 1111 comments)

**Event Structure:**
```json
{
  "kind": 4550,
  "content": "<full-approved-comment-event-json>",
  "tags": [
    ["a", "<community-id>"],
    ["e", "<comment-id>"],
    ["p", "<comment-author-pubkey>"],
    ["k", "1111"],
    ["alt", "Approved comment <comment-id> in <community-id>"]
  ]
}
```

**Tags:**
- **`a`** (required): References the target community
- **`e`** (required): References the approved comment
- **`p`** (required): References the comment author
- **`k`** (required): Kind of the approved comment (typically "1111")
- **`alt`** (required): Human-readable description per NIP-31

**Content:**
Contains the full JSON of the approved comment event for redistribution.

**Behavior:**
- Required for comments from users not in the approved members list
- Comments from approved members (Kind 34551) are automatically approved
- Only community moderators can create approval events

#### Post Removal (Kind 4551)

**Kind:** 4551 (Regular Event)
**Purpose:** Indicates a moderator has removed a post from the community

**Event Structure:**
```json
{
  "kind": 4551,
  "content": "<optional-moderation-reason>",
  "tags": [
    ["a", "<community-id>"],
    ["e", "<removed-post-id>"],
    ["p", "<post-author-pubkey>"],
    ["k", "1111"],
    ["alt", "Removed post <removed-post-id> from <community-id>"]
  ]
}
```

**Tags:**
- **`a`** (required): References the target community
- **`e`** (required): References the removed comment
- **`p`** (required): References the comment author
- **`k`** (required): Kind of the original comment (typically "1111")
- **`alt`** (required): Human-readable description per NIP-31

**Content:**
Optional moderation reason explaining why the post was removed.

**Behavior:**
- Removes the post from community view
- Content is hidden from non-moderators
- Only community moderators can remove posts

#### Join Request (Kind 4552)

**Kind:** 4552 (Regular Event)
**Purpose:** Represents a user's request to join a community

**Event Structure:**
```json
{
  "kind": 4552,
  "content": "<optional-join-message>",
  "tags": [
    ["a", "<community-id>"],
    ["alt", "Join request for <community-id>"]
  ]
}
```

**Tags:**
- **`a`** (required): References the target community
- **`alt`** (required): Human-readable description per NIP-31

**Content:**
Optional message from the user explaining why they want to join the community.

**Behavior:**
- Users send join requests to communities they want to participate in
- Moderators can approve (add to Kind 34551) or decline (add to Kind 34552) requests
- Users can send multiple join requests if previous ones were declined

#### Space Leave Request (Kind 4553)

**Kind:** 4553 (Regular Event)
**Purpose:** Request to leave a community/space

### Description

Space leave request events allow users to formally request to leave a community or space. When a user sends a leave request, they will be hidden from the community members list and their own community/spaces list if the leave request is more recent than any join request.

### Event Structure

```json
{
  "kind": 4553,
  "content": "<optional-message>",
  "tags": [
    ["a", "<community-id>"],
    ["alt", "Leave request for <community-id>"]
  ]
}
```

### Tags

- **`a`** (required): Reference to the community (kind 34550 event) being left
- **`alt`** (required): Human-readable description per NIP-31

### Content

The content field contains an optional message from the user explaining why they are leaving the space.

### Behavior

When processing leave requests:

1. **Membership Status**: Users with a leave request more recent than any join request are considered to have left the space
2. **UI Filtering**: Users who have left are hidden from:
   - Community members list
   - User's personal community/spaces list
3. **Timing Logic**: Leave requests override join requests when `leave_request.created_at > join_request.created_at`

### Usage Example

```json
{
  "kind": 4553,
  "content": "I need to focus on other projects right now",
  "tags": [
    ["a", "34550:pubkey1:community-id"],
    ["alt", "Leave request for community-id"]
  ]
}
```

### Client Implementation

Clients SHOULD:
1. Query for kind 4553 events when determining membership status
2. Compare timestamps of join (kind 4552) and leave (kind 4553) requests
3. Hide users from UI lists if they have a more recent leave request
4. Allow users to rejoin after leaving by sending a new join request

Clients MAY:
1. Show leave requests to moderators for administrative purposes
2. Provide a grace period before fully removing users from lists
3. Send notifications to moderators when users leave

### Related Kinds

- **Kind 4552**: Join request events
- **Kind 34550**: Community definition events
- **Kind 34551**: Approved members list

#### Close Report (Kind 4554)

**Kind:** 4554 (Regular Event)
**Purpose:** Indicates a moderator has resolved a report (Kind 1984)

**Event Structure:**
```json
{
  "kind": 4554,
  "content": "<resolution-details>",
  "tags": [
    ["e", "<original-report-id>"],
    ["a", "<community-id>"],
    ["t", "<action-type>"],
    ["alt", "Resolved report <original-report-id> in <community-id>"]
  ]
}
```

**Tags:**
- **`e`** (required): References the original report event
- **`a`** (required): References the target community
- **`t`** (required): Action taken (e.g., "content removed", "user banned", "closed without action")
- **`alt`** (required): Human-readable description per NIP-31

**Content:**
Detailed explanation of how the report was resolved.

**Behavior:**
- Closes the report and marks it as resolved
- Provides transparency about moderation actions
- Only community moderators can close reports

## Application-Specific Event Kinds

### Application Data (Kind 30078)

**Kind:** 30078 (Replaceable Event)
**Purpose:** Store application-specific data for moderation and other features

**Event Structure:**
```json
{
  "kind": 30078,
  "content": "<application-data-json>",
  "tags": [
    ["d", "<data-identifier>"],
    ["alt", "Application data: <data-identifier>"]
  ]
}
```

**Tags:**
- **`d`** (required): Unique identifier for the data type
- **`alt`** (required): Human-readable description per NIP-31

**Content:**
JSON object containing application-specific data.

**Usage:**
- Moderation settings and configurations
- Auto-moderation rules
- Community-specific application settings
- Other app data that needs to be stored on Nostr

### User Status (Kind 30315)

**Kind:** 30315 (Replaceable Event)
**Purpose:** Store user status information including traditional status and custom status messages

**Event Structure:**
```json
{
  "kind": 30315,
  "content": "<status-emoji>",
  "tags": [
    ["d", "status"],
    ["status", "<traditional-status>"],
    ["message", "<custom-message>"],
    ["alt", "User status: <traditional-status>"]
  ]
}
```

**Tags:**
- **`d`** (required): Identifier for status data (typically "status")
- **`status`** (optional): Traditional status ("online", "busy", "away", "offline")
- **`message`** (optional): Custom status message
- **`alt`** (required): Human-readable description per NIP-31

**Content:**
Emoji representing the user's status.

**Traditional Status Values:**
- **online**: User is active and available
- **busy**: User is busy and doesn't want to be disturbed
- **away**: User is away from their device
- **offline**: User is offline or invisible

**Behavior:**
- Users can set their status to indicate availability
- Status is displayed in user profiles and chat interfaces
- Status expires after a period of inactivity (typically 5 minutes)
- Music status can also be stored using `d: "music"` with additional tags

### Voice Channel State (Kind 30316)

**Kind:** 30316 (Regular Event)
**Purpose:** Manage voice channel member state and WebRTC presence

**Event Structure:**
```json
{
  "kind": 30316,
  "content": "",
  "tags": [
    ["d", "<channel-id>"],
    ["action", "<action-type>"],
    ["muted", "<true|false>"],
    ["deafened", "<true|false>"],
    ["speaking", "<true|false>"],
    ["alt", "Voice channel <action-type> for <channel-id>"]
  ]
}
```

**Tags:**
- **`d`** (required): Voice channel identifier
- **`action`** (required): Action type ("join", "leave", "heartbeat", "update")
- **`muted`** (optional): Whether user is muted (true/false)
- **`deafened`** (optional): Whether user is deafened (true/false)
- **`speaking`** (optional): Whether user is currently speaking (true/false)
- **`alt`** (required): Human-readable description per NIP-31

**Action Types:**
- **join**: User is joining the voice channel
- **leave**: User is leaving the voice channel
- **heartbeat**: Periodic presence update (every 20 seconds)
- **update**: User state change (mute/deafen/speaking)

**Behavior:**
- Tracks real-time presence in voice channels
- Manages audio state (muted, deafened, speaking)
- Enables peer-to-peer audio connections via WebRTC
- Provides voice activity detection
- Handles connection health monitoring and reconnection

### Voice Signaling (Kind 30317)

**Kind:** 30317 (Regular Event)
**Purpose:** WebRTC signaling for establishing peer-to-peer voice connections

**Event Structure:**
```json
{
  "kind": 30317,
  "content": "<signaling-message-json>",
  "tags": [
    ["d", "<channel-id>:<target-pubkey>:<timestamp>"],
    ["p", "<target-pubkey>"],
    ["channel", "<channel-id>"],
    ["signal_type", "<signal-type>"],
    ["attempt", "<attempt-number>"],
    ["alt", "WebRTC <signal-type> to <target-pubkey>"]
  ]
}
```

**Tags:**
- **`d`** (required): Unique identifier combining channel, target, and timestamp
- **`p`** (required): Target user pubkey for the signaling message
- **`channel`** (required): Voice channel identifier
- **`signal_type`** (required): Type of signaling message ("offer", "answer", "ice-candidate")
- **`attempt`** (optional): Retry attempt number for reliability
- **`alt`** (required): Human-readable description per NIP-31

**Content:**
JSON string containing WebRTC signaling data:
```json
{
  "type": "offer" | "answer" | "ice-candidate",
  "data": <RTCSessionDescriptionInit | RTCIceCandidate>,
  "from": "<sender-pubkey>",
  "to": "<target-pubkey>",
  "channelId": "<channel-id>"
}
```

**Signal Types:**
- **offer**: SDP offer to initiate WebRTC connection
- **answer**: SDP response to accept connection
- **ice-candidate**: ICE candidate for establishing connection path

**Behavior:**
- Enables peer-to-peer audio streaming without central servers
- Handles NAT traversal using STUN/TURN servers
- Provides automatic reconnection on connection failure
- Implements retry logic with exponential backoff
- Supports multiple ICE candidates for better connectivity

### Channel Folder Definitions (Kind 32603)

**Kind:** 32603 (Addressable Event)
**Purpose:** Define folder structures for organizing channels within communities

**Event Structure:**
```json
{
  "kind": 32603,
  "content": "<folder-metadata-json>",
  "tags": [
    ["d", "<folder-identifier>"],
    ["a", "<community-id>"],
    ["name", "<folder-name>"],
    ["channel", "<channel-id>"],
    ["channel", "<channel-id>"],
    ["alt", "Channel folder: <folder-name>"]
  ]
}
```

**Tags:**
- **`d`** (required): Unique identifier for the folder
- **`a`** (required): Reference to the community this folder belongs to
- **`name`** (required): Display name of the folder
- **`channel`** (multiple): Channel identifiers contained in this folder
- **`alt`** (required): Human-readable description per NIP-31

**Content:**
JSON object with folder metadata:
```json
{
  "description": "<folder-description>",
  "icon": "<optional-icon-identifier>",
  "color": "<optional-color-hex>",
  "collapsed": <boolean>,
  "order": <number>
}
```

**Behavior:**
- Allows communities to organize channels into hierarchical folders
- Channels can be grouped by topic, purpose, or team
- Folders can be collapsed/expanded in the UI
- Supports drag-and-drop reordering
- Only community moderators can create and manage folders

## Channel Permissions (Kind 30143)

## Space Leave Request (Kind 4553)

**Kind:** 4553 (Regular Event)
**Purpose:** Request to leave a community/space

### Description

Space leave request events allow users to formally request to leave a community or space. When a user sends a leave request, they will be hidden from the community members list and their own community/spaces list if the leave request is more recent than any join request.

### Event Structure

```json
{
  "kind": 4553,
  "content": "<optional-message>",
  "tags": [
    ["a", "<community-id>"],
    ["alt", "Leave request for <community-id>"]
  ]
}
```

### Tags

- **`a`** (required): Reference to the community (kind 34550 event) being left
- **`alt`** (required): Human-readable description per NIP-31

### Content

The content field contains an optional message from the user explaining why they are leaving the space.

### Behavior

When processing leave requests:

1. **Membership Status**: Users with a leave request more recent than any join request are considered to have left the space
2. **UI Filtering**: Users who have left are hidden from:
   - Community members list
   - User's personal community/spaces list
3. **Timing Logic**: Leave requests override join requests when `leave_request.created_at > join_request.created_at`

### Usage Example

```json
{
  "kind": 4553,
  "content": "I need to focus on other projects right now",
  "tags": [
    ["a", "34550:pubkey1:community-id"],
    ["alt", "Leave request for community-id"]
  ]
}
```

### Client Implementation

Clients SHOULD:
1. Query for kind 4553 events when determining membership status
2. Compare timestamps of join (kind 4552) and leave (kind 4553) requests
3. Hide users from UI lists if they have a more recent leave request
4. Allow users to rejoin after leaving by sending a new join request

Clients MAY:
1. Show leave requests to moderators for administrative purposes
2. Provide a grace period before fully removing users from lists
3. Send notifications to moderators when users leave

### Related Kinds

- **Kind 4552**: Join request events
- **Kind 34550**: Community definition events
- **Kind 34551**: Approved members list

## Channel Permissions (Kind 30143)

**Kind:** 30143 (Addressable Event)
**Purpose:** Define read and write permissions for community channels

### Description

Channel permissions events allow community moderators to control who can read and write messages in specific channels. This enables private channels, moderator-only channels, and fine-grained access control within communities.

### Event Structure

```json
{
  "kind": 30143,
  "content": "{\"readPermissions\":\"members\",\"writePermissions\":\"members\"}",
  "tags": [
    ["d", "<community-id>:<channel-id>"],
    ["a", "<community-id>"],
    ["channel", "<channel-id>"],
    ["t", "channel-permissions"],
    ["alt", "Channel permissions for <channel-id>"],
    ["p", "<user-pubkey>", "", "read-allow"],
    ["p", "<user-pubkey>", "", "write-allow"],
    ["p", "<user-pubkey>", "", "read-deny"],
    ["p", "<user-pubkey>", "", "write-deny"]
  ]
}
```

### Tags

- **`d`** (required): Unique identifier combining community ID and channel ID
- **`a`** (required): Reference to the community (kind 34550 event)
- **`channel`** (required): The channel identifier
- **`t`** (required): Must be "channel-permissions" for filtering
- **`alt`** (required): Human-readable description per NIP-31
- **`p`** (optional): User permissions with role markers:
  - `read-allow`: User is explicitly allowed to read
  - `write-allow`: User is explicitly allowed to write
  - `read-deny`: User is explicitly denied read access
  - `write-deny`: User is explicitly denied write access

### Content

The content field contains a JSON object with permission settings:

```json
{
  "readPermissions": "everyone" | "members" | "moderators" | "specific",
  "writePermissions": "everyone" | "members" | "moderators" | "specific"
}
```

### Permission Levels

1. **`everyone`**: All users can access the channel
2. **`members`**: Only community members can access the channel
3. **`moderators`**: Only community moderators and admins can access the channel
4. **`specific`**: Only users listed in `read-allow`/`write-allow` tags can access

### Permission Evaluation

Permissions are evaluated in this order:

1. **Explicit denial**: If user is in `read-deny` or `write-deny` tags, access is denied
2. **Moderator access**: Community moderators and admins have access unless explicitly denied
3. **Permission level check**: Based on `readPermissions`/`writePermissions` setting
4. **Specific access**: If permission is "specific", user must be in corresponding allow list

### Default Permissions

If no permissions event exists for a channel:
- **Read permissions**: `everyone`
- **Write permissions**: `members`

### Usage Examples

#### Public Channel
```json
{
  "content": "{\"readPermissions\":\"everyone\",\"writePermissions\":\"everyone\"}"
}
```

#### Members-Only Channel
```json
{
  "content": "{\"readPermissions\":\"members\",\"writePermissions\":\"members\"}"
}
```

#### Moderator-Only Channel
```json
{
  "content": "{\"readPermissions\":\"moderators\",\"writePermissions\":\"moderators\"}"
}
```

#### Specific Users Channel
```json
{
  "content": "{\"readPermissions\":\"specific\",\"writePermissions\":\"specific\"}",
  "tags": [
    ["p", "user1pubkey", "", "read-allow"],
    ["p", "user1pubkey", "", "write-allow"],
    ["p", "user2pubkey", "", "read-allow"],
    ["p", "user2pubkey", "", "write-allow"]
  ]
}
```

### Client Implementation

Clients SHOULD:
1. Check channel permissions before displaying messages or allowing message input
2. Show appropriate UI indicators for private channels
3. Respect permission hierarchies (moderators > members > everyone)
4. Handle permission changes gracefully with real-time updates

Clients MAY:
1. Cache permissions for performance
2. Show different UI states for read-only vs no-access channels
3. Provide visual indicators of channel privacy level

### Relay Considerations

Relays MAY implement server-side filtering based on channel permissions, but clients MUST NOT rely on this and should implement their own permission checks.

## Group Discussion Implementation

### Channel Messages (Kind 9411)

**Kind:** 9411 (Regular Event)
**Purpose:** Real-time channel messaging within communities (NIP-28 Public Chat)

This application uses Kind 9411 for real-time messaging in community channels, providing instant communication similar to Discord or Slack channels.

#### Event Structure
```json
{
  "kind": 9411,
  "content": "<message-content>",
  "tags": [
    ["a", "<community-id>"],
    ["t", "<channel-id>"],
    ["e", "<root-event-id>"], // Optional: for threading
    ["p", "<mentioned-user-pubkey>"], // Optional: for user mentions
    ["alt", "Message in <channel-id> of <community-id>"]
  ]
}
```

**Tags:**
- **`a`** (required): Reference to the community (kind 34550 event)
- **`t`** (required): Channel identifier within the community
- **`e`** (optional): Root event ID for threaded conversations
- **`p`** (optional): Mentioned user pubkeys for @mentions
- **`alt`** (required): Human-readable description per NIP-31

**Content:**
The message content, which can include:
- Plain text messages
- URLs (automatically linkified)
- Mentions using `@npub1...` or `@username` format
- Emoji and emoji reactions
- File attachments via NIP-94 tags

**Behavior:**
- Messages are delivered in real-time to channel participants
- Supports threading when `e` tag is present
- Respects channel permissions (Kind 30143)
- Can be pinned using Kind 34554 events
- Supports reactions (Kind 7) and zaps (Kind 9735)
- Messages from non-approved members require moderation approval (Kind 4550)

**Query Patterns:**
- **Channel messages**: Filter Kind 9411 by `#a` (community) and `#t` (channel)
- **Threaded messages**: Filter Kind 9411 by `#e` (root event)
- **User mentions**: Filter Kind 9411 by `#p` (mentioned user)

**Client Implementation:**
Clients SHOULD:
- Display messages in real-time with typing indicators
- Support message threading and replies
- Render mentions with user profiles and avatars
- Handle message deletion (Kind 5) and editing
- Show read receipts and delivery status
- Respect channel permissions and moderation state
- Support file uploads and media previews

### Comment Events (Kind 1111)

**Kind:** 1111 (Regular Event)
**Purpose:** Group discussions using NIP-22 comments scoped to communities

This application uses Kind 1111 (NIP-22 Comments) for all group discussions within communities, with the community itself serving as the root event for threading.

#### Top-Level Post Structure
```json
{
  "kind": 1111,
  "content": "<post-content>",
  "tags": [
    ["A", "<community-id>"],
    ["K", "34550"],
    ["P", "<community-creator-pubkey>"],
    ["a", "<community-id>"],
    ["k", "34550"],
    ["p", "<community-creator-pubkey>"],
    ["alt", "Post in <community-id>"]
  ]
}
```

#### Reply Structure
```json
{
  "kind": 1111,
  "content": "<reply-content>",
  "tags": [
    ["A", "<community-id>"],
    ["K", "34550"],
    ["P", "<community-creator-pubkey>"],
    ["e", "<parent-comment-id>"],
    ["k", "1111"],
    ["p", "<parent-author-pubkey>"],
    ["alt", "Reply to comment <parent-comment-id>"]
  ]
}
```

**Tags:**
- **`A`** (required): Root scope - the community (uppercase)
- **`K`** (required): Root kind - community kind (uppercase)
- **`P`** (required): Root author - community creator (uppercase)
- **`a`** (required): Parent scope - same as root for top-level posts (lowercase)
- **`k`** (required): Parent kind - community for top-level, comment for replies (lowercase)
- **`p`** (required): Parent author - community creator for top-level, comment author for replies (lowercase)
- **`e`** (optional for replies): Parent event ID for threaded replies
- **`alt`** (required): Human-readable description per NIP-31

**Query Patterns:**
- **Top-level posts**: Filter Kind 1111 where parent kind (`k` tag) is "34550"
- **Replies**: Filter Kind 1111 where parent kind (`k` tag) is "1111"
- **All community content**: Filter Kind 1111 by root scope (`#A` tag)

## Related NIPs

- **NIP-72**: Moderated Communities - Provides the community framework
- **NIP-22**: Comment Threads - Defines the threading system used for discussions
- **NIP-28**: Public Chat - Defines basic channel messaging
- **NIP-31**: Dealing with Unknown Events - Requires `alt` tags
- **NIP-15**: Marketplace/Products - Used for marketplace functionality
- **NIP-52**: Calendar Events - Used for calendar and RSVP functionality

## Security Considerations

1. **Permission inheritance**: Moderators always have access unless explicitly denied
2. **Denial precedence**: Explicit denial overrides all other permissions
3. **Client-side enforcement**: Permissions are enforced by clients, not guaranteed by relays
4. **Key management**: Only community moderators should be able to create/update permission events
5. **Member list security**: Member management events should only be updated by community moderators
6. **Report resolution**: Report resolution events should only be created by authorized moderators
7. **Voice privacy**: Voice signaling events should be encrypted end-to-end and not stored long-term
8. **Status expiration**: User status events should have reasonable expiration times to prevent stale data

## Implementation Guidelines

### Auto-Approval Workflow
Comments from users in the approved members list (Kind 34551) are automatically considered approved without requiring individual Kind 4550 approval events. This reduces moderation overhead for trusted community members.

### Moderation Hierarchy
1. **Community Creator**: Has full control over the community
2. **Moderators**: Listed in the community definition with `["p", pubkey, relay, "moderator"]` tags
3. **Approved Members**: Can post comments without individual approval
4. **Regular Members**: Comments require moderator approval
5. **Banned Users**: Cannot post, all content hidden

### Client Implementation Requirements
Clients SHOULD:
- Display approved comments by default
- Provide toggles to view pending/unapproved content for moderators
- Hide content from banned users
- Show visual indicators for pinned posts
- Implement join request workflows for private communities
- Support NIP-22 threaded replies within communities
- Properly distinguish between top-level comments (parent kind "34550") and nested replies (parent kind "1111")
- Query using appropriate tag filters (`#A` for root scope, `#e` for parent events)
- Handle voice channel state changes and WebRTC signaling
- Respect channel permissions and folder organizations
- Cache user status and presence information appropriately