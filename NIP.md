# Community Spaces and Voice Channels

This document defines custom Nostr event kinds used by this community application for implementing "spaces" - mini-applications within communities, and voice channel functionality.

## Event Kind 39097: Community Space Configuration

**Event Kind**: 39097 (Addressable Event)
**Purpose**: Configure and manage community spaces (mini-applications within communities)

### Description

Community spaces are optional mini-applications that can be added to communities to provide specialized functionality beyond basic chat. Examples include marketplaces, resource collections, event calendars, etc.

### Event Structure

```json
{
  "kind": 39097,
  "content": "<JSON-encoded space configuration>",
  "tags": [
    ["d", "<community-id>:<space-id>"],
    ["a", "<community-id>"],
    ["name", "<space-name>"],
    ["description", "<space-description>"],
    ["space_type", "<marketplace|resources|custom>"],
    ["icon", "<icon-name>"],
    ["enabled", "<true|false>"],
    ["position", "<sort-order>"],
    ["t", "space"],
    ["alt", "Space: <space-name>"]
  ]
}
```

### Tags

- **`d`** (required): Unique identifier in format `<community-id>:<space-id>`
- **`a`** (required): Reference to the community (kind 34550 event)
- **`name`** (required): Human-readable name of the space
- **`description`** (optional): Description of what the space is for
- **`space_type`** (required): Type of space - `marketplace`, `resources`, or `custom`
- **`icon`** (required): Icon identifier for UI display
- **`enabled`** (required): Whether the space is currently enabled (`true`/`false`)
- **`position`** (required): Sort order for space display
- **`t`** (required): Tag with value `space` for filtering
- **`alt`** (required): Human-readable description for NIP-31 compatibility

### Content

The `content` field contains a JSON object with the same information as the tags for redundancy and future extensibility:

```json
{
  "name": "Marketplace",
  "description": "Buy and sell goods with Bitcoin, Lightning, and Cashu",
  "type": "marketplace",
  "icon": "ShoppingBag",
  "enabled": true,
  "position": 0
}
```

### Space Types

#### `marketplace`
Uses NIP-15 (Nostr Marketplace) events for buying and selling goods. Queries for kind 30018 (product) events.

#### `resources`
Uses NIP-51 bookmark sets (kind 30003) for organizing collections of links, files, and Nostr content.

#### `custom`
User-defined spaces for future extensibility. The implementation can define custom behavior for these spaces.

### Default Spaces

Every community starts with two default spaces:

1. **Marketplace** (`marketplace` type) - For trading goods
2. **Resources** (`resources` type) - For sharing links and resources

These default spaces can be disabled but not deleted. Community administrators can add additional custom spaces.

### Usage

Community administrators can:
- Enable/disable spaces
- Reorder spaces by changing the `position` value
- Add custom spaces with unique functionality
- Configure space names, descriptions, and icons

### Client Implementation

Clients should:
1. Query for kind 39097 events with `#a` tag matching the community ID
2. Merge results with default spaces, applying custom configurations
3. Filter to only show enabled spaces
4. Sort by position value
5. Render appropriate space content based on the `space_type`

### Examples

#### Enable Marketplace Space
```json
{
  "kind": 39097,
  "content": "{\"name\":\"Marketplace\",\"description\":\"Buy and sell goods with Bitcoin, Lightning, and Cashu\",\"type\":\"marketplace\",\"icon\":\"ShoppingBag\",\"enabled\":true,\"position\":0}",
  "tags": [
    ["d", "34550:alice123:farming-community:marketplace"],
    ["a", "34550:alice123:farming-community"],
    ["name", "Marketplace"],
    ["description", "Buy and sell goods with Bitcoin, Lightning, and Cashu"],
    ["space_type", "marketplace"],
    ["icon", "ShoppingBag"],
    ["enabled", "true"],
    ["position", "0"],
    ["t", "space"],
    ["alt", "Space: Marketplace"]
  ]
}
```

#### Add Custom Events Space
```json
{
  "kind": 39097,
  "content": "{\"name\":\"Events\",\"description\":\"Community calendar and event planning\",\"type\":\"custom\",\"icon\":\"Calendar\",\"enabled\":true,\"position\":2}",
  "tags": [
    ["d", "34550:alice123:farming-community:events"],
    ["a", "34550:alice123:farming-community"],
    ["name", "Events"],
    ["description", "Community calendar and event planning"],
    ["space_type", "custom"],
    ["icon", "Calendar"],
    ["enabled", "true"],
    ["position", "2"],
    ["t", "space"],
    ["alt", "Space: Events"]
  ]
}
```

## Integration with Existing NIPs

### NIP-15: Marketplace Space
When the marketplace space is enabled, the application queries for NIP-15 product events (kind 30018) and displays them in a marketplace interface.

### NIP-51: Resources Space
When the resources space is enabled, the application queries for NIP-51 bookmark sets (kind 30003) and displays them as organized resource collections.

### NIP-72: Community Integration
Spaces are tied to NIP-72 communities via the `a` tag referencing the community definition event (kind 34550).

This design allows communities to have optional specialized functionality while maintaining compatibility with existing Nostr standards.

## Event Kind 34551: Approved Members List

**Event Kind**: 34551 (Addressable Event)
**Purpose**: Maintain a list of users who are pre-approved to post in the community without requiring individual post approvals

### Description

Approved members lists track users who have been granted automatic posting privileges in a community. Comments from users in this list are automatically considered approved without requiring individual Kind 4550 approval events, reducing moderation overhead for trusted community members.

### Event Structure

```json
{
  "kind": 34551,
  "content": "",
  "tags": [
    ["d", "<community-id>"],
    ["p", "<approved-user-1-pubkey>"],
    ["p", "<approved-user-2-pubkey>"],
    ["p", "<approved-user-3-pubkey>"],
    ["alt", "Approved members list for community"]
  ]
}
```

### Tags

- **`d`** (required): Community identifier (same as community definition `d` tag)
- **`p`** (multiple): Public keys of approved members
- **`alt`** (required): Human-readable description for NIP-31 compatibility

### Usage

Only community moderators and owners can create and update approved members lists. When a user from this list posts a comment (Kind 1111) to the community, clients should treat it as automatically approved without waiting for a Kind 4550 approval event.

## Event Kind 34552: Declined Members List

**Event Kind**: 34552 (Addressable Event)
**Purpose**: Track users whose join requests have been declined

### Description

Declined members lists track users whose join requests have been explicitly declined by community moderators. This prevents the same users from appearing in pending join requests repeatedly and provides a record of moderation decisions.

### Event Structure

```json
{
  "kind": 34552,
  "content": "",
  "tags": [
    ["d", "<community-id>"],
    ["p", "<declined-user-1-pubkey>"],
    ["p", "<declined-user-2-pubkey>"],
    ["alt", "Declined members list for community"]
  ]
}
```

### Tags

- **`d`** (required): Community identifier (same as community definition `d` tag)
- **`p`** (multiple): Public keys of declined users
- **`alt`** (required): Human-readable description for NIP-31 compatibility

### Usage

When a moderator declines a join request (Kind 4552), the user's public key is added to this list. Users on this list should not appear in pending join requests queries, and their future join requests may be automatically filtered out by clients.

## Event Kind 34553: Banned Members List

**Event Kind**: 34553 (Addressable Event)
**Purpose**: Maintain a list of users who are banned from the community

### Description

Banned members lists track users who have been banned from participating in the community. Banned users cannot post comments, and their existing content should be hidden from community views.

### Event Structure

```json
{
  "kind": 34553,
  "content": "",
  "tags": [
    ["d", "<community-id>"],
    ["p", "<banned-user-1-pubkey>"],
    ["p", "<banned-user-2-pubkey>"],
    ["alt", "Banned members list for community"]
  ]
}
```

### Tags

- **`d`** (required): Community identifier (same as community definition `d` tag)
- **`p`** (multiple): Public keys of banned users
- **`alt`** (required): Human-readable description for NIP-31 compatibility

### Usage

Banned users should have all their content hidden from community views, and they should be prevented from posting new comments. Clients should respect banned user lists across all community interactions and may choose to automatically reject events from banned users.

## Member Management Workflow

### Join Request Process

1. **User submits join request**: Kind 4552 event with community `a` tag
2. **Moderator reviews request**: Appears in moderation dashboard
3. **Moderator takes action**:
   - **Approve**: Add user to Kind 34551 (Approved Members List)
   - **Decline**: Add user to Kind 34552 (Declined Members List)
   - **Ban**: Add user to Kind 34553 (Banned Members List)

### Auto-Approval System

Users in the approved members list (Kind 34551) can post comments without individual approval:
- Their Kind 1111 comments are automatically visible
- No Kind 4550 approval event is required
- Reduces moderation workload for trusted members

### Query Patterns

**Get pending join requests:**
```json
{
  "kinds": [4552],
  "#a": ["<community-id>"],
  "limit": 50
}
```

**Get community member lists:**
```json
{
  "kinds": [34551, 34552, 34553],
  "#d": ["<community-id>"],
  "limit": 10
}
```

**Check if user is approved:**
```json
{
  "kinds": [34551],
  "#d": ["<community-id>"],
  "#p": ["<user-pubkey>"],
  "limit": 1
}
```

### Client Implementation

Clients should:
1. Query for all three member list types when loading a community
2. Use the most recent event for each kind (highest `created_at`)
3. Filter join requests to exclude users already in declined/banned lists
4. Auto-approve comments from users in the approved list
5. Hide content from banned users
6. Provide moderation interfaces for managing these lists

### Security Considerations

- Only community moderators and owners should be able to update member lists
- Clients should verify the author of member list events has moderation permissions
- Member lists should be queried from trusted relays
- Consider rate limiting to prevent spam join requests

## Event Kind 30316: Voice Channel State

**Event Kind**: 30316 (Addressable Event)
**Purpose**: Track voice channel membership and user states

### Description

Voice channel state events track who is currently in voice channels and their audio states (muted, deafened, speaking). These events enable real-time voice channel member lists and status indicators.

### Event Structure

```json
{
  "kind": 30316,
  "content": "",
  "tags": [
    ["d", "<channel-id>"],
    ["action", "<join|leave|update>"],
    ["muted", "<true|false>"],
    ["deafened", "<true|false>"],
    ["speaking", "<true|false>"],
    ["alt", "Voice channel state update"]
  ]
}
```

### Tags

- **`d`** (required): Voice channel identifier
- **`action`** (required): Action type - `join`, `leave`, or `update`
- **`muted`** (optional): Whether user's microphone is muted (`true`/`false`)
- **`deafened`** (optional): Whether user has deafened themselves (`true`/`false`)
- **`speaking`** (optional): Whether user is currently speaking (`true`/`false`)
- **`alt`** (required): Human-readable description for NIP-31 compatibility

### Actions

#### `join`
Published when a user joins a voice channel. Includes initial muted/deafened state.

#### `leave`
Published when a user leaves a voice channel. Only requires `d` and `action` tags.

#### `update`
Published when a user's voice state changes (mute/unmute, deafen/undeafen, speaking status).

### Client Implementation

Clients should:
1. Query for kind 30316 events with `#d` tag matching the channel ID
2. Process events chronologically to build current member state
3. Remove members who have published `leave` actions
4. Update member states based on `update` actions
5. Refresh periodically to handle missed events

## Event Kind 30317: Voice Channel WebRTC Signaling

**Event Kind**: 30317 (Addressable Event)
**Purpose**: WebRTC signaling for peer-to-peer voice connections

### Description

Voice signaling events enable WebRTC peer-to-peer audio connections between voice channel members. These events carry WebRTC offers, answers, and ICE candidates for establishing direct audio streams.

### Event Structure

```json
{
  "kind": 30317,
  "content": "<JSON-encoded signaling message>",
  "tags": [
    ["d", "<channel-id>:<target-pubkey>:<timestamp>"],
    ["p", "<target-pubkey>"],
    ["channel", "<channel-id>"],
    ["signal_type", "<offer|answer|ice-candidate>"],
    ["alt", "WebRTC signaling message"]
  ]
}
```

### Tags

- **`d`** (required): Unique identifier in format `<channel-id>:<target-pubkey>:<timestamp>`
- **`p`** (required): Target recipient's pubkey
- **`channel`** (required): Voice channel identifier
- **`signal_type`** (required): Type of signaling message
- **`alt`** (required): Human-readable description for NIP-31 compatibility

### Content

The `content` field contains a JSON-encoded signaling message:

```json
{
  "type": "offer|answer|ice-candidate",
  "data": "<WebRTC offer/answer/ICE candidate>",
  "from": "<sender-pubkey>",
  "to": "<recipient-pubkey>",
  "channelId": "<channel-id>"
}
```

### Signaling Flow

1. **Offer**: User A creates WebRTC offer and publishes kind 30317 event to User B
2. **Answer**: User B receives offer, creates answer, and publishes kind 30317 event to User A
3. **ICE Candidates**: Both users publish ICE candidates as they're discovered
4. **Connection**: WebRTC peer connection establishes direct audio stream

### Security Considerations

- Signaling messages are public but only contain WebRTC negotiation data
- Actual audio streams are peer-to-peer and not visible to relays
- Users should validate signaling messages are from expected channel members
- ICE candidates may reveal IP addresses (standard WebRTC behavior)

### Client Implementation

Clients should:
1. Query for kind 30317 events with `#p` tag matching user's pubkey
2. Filter events by channel ID to relevant voice channel
3. Process signaling messages to establish WebRTC connections
4. Handle connection failures gracefully with reconnection attempts
5. Clean up old signaling events (they're only needed during connection setup)

This design enables decentralized voice chat without requiring centralized signaling servers, using Nostr relays for WebRTC negotiation.