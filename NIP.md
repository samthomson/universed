# Custom Nostr Protocol Extensions

This document describes custom event kinds and protocol extensions used by this Nostr client application.

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

## Related NIPs

- **NIP-72**: Moderated Communities - Provides the community framework
- **NIP-28**: Public Chat - Defines basic channel messaging
- **NIP-31**: Dealing with Unknown Events - Requires `alt` tags

## Security Considerations

1. **Permission inheritance**: Moderators always have access unless explicitly denied
2. **Denial precedence**: Explicit denial overrides all other permissions
3. **Client-side enforcement**: Permissions are enforced by clients, not guaranteed by relays
4. **Key management**: Only community moderators should be able to create/update permission events