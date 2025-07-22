# NIP-72 Extensions for Community Membership

`draft` `optional`

This document describes extensions to NIP-72 (Moderated Communities) that enhance community management and user membership capabilities, inspired by the Chorus platform's approach to group membership.

## Background

NIP-72 defines the basic framework for moderated communities on Nostr using:
- **Kind 34550**: Community definition events
- **Kind 4550**: Post approval events

This extension adds membership management capabilities to enable communities to track and manage their member lists, providing better user experience and community organization.

## Core NIP-72 Event Kinds

### Kind 34550: Community Definition
Defines a community with metadata and moderator lists as specified in NIP-72.

### Kind 4550: Post Approval  
Moderator approval events for posts as specified in NIP-72.

## Membership Management Extensions

### Kind 34551: Approved Members List
**Addressable event** that maintains a list of users who are pre-approved to post in the community without requiring individual post approvals.

**Tags:**
- `["d", communityId]` - Identifies which community this list belongs to
- `["p", pubkey]` - One tag per approved member

**Example:**
```json
{
  "kind": 34551,
  "pubkey": "moderator_pubkey",
  "created_at": 1234567890,
  "tags": [
    ["d", "34550:community_creator_pubkey:bitcoin-discussion"],
    ["p", "approved_user_1_pubkey"],
    ["p", "approved_user_2_pubkey"],
    ["p", "approved_user_3_pubkey"]
  ],
  "content": ""
}
```

### Kind 34552: Declined Members List
**Addressable event** that tracks users whose join requests have been declined.

**Tags:**
- `["d", communityId]` - Identifies which community this list belongs to  
- `["p", pubkey]` - One tag per declined user

### Kind 34553: Banned Members List
**Addressable event** that maintains a list of users who are banned from the community.

**Tags:**
- `["d", communityId]` - Identifies which community this list belongs to
- `["p", pubkey]` - One tag per banned user

### Kind 4552: Join Request
**Regular event** that represents a user's request to join a community.

**Tags:**
- `["a", communityId]` - References the target community

**Example:**
```json
{
  "kind": 4552,
  "pubkey": "requesting_user_pubkey",
  "created_at": 1234567890,
  "tags": [
    ["a", "34550:community_creator_pubkey:bitcoin-discussion"]
  ],
  "content": "I would like to join this community to discuss Bitcoin topics."
}
```

### Kind 4553: Leave Request  
**Regular event** that represents a user's request to leave a community.

**Tags:**
- `["a", communityId]` - References the target community

## Implementation Notes

### Membership Status Determination

A user's membership status in a community is determined by checking the following events in order:

1. **Community Creator**: If the user's pubkey matches the community creator, they are automatically a member with owner privileges
2. **Moderators**: If the user's pubkey is listed in the community definition with moderator role, they are automatically a member with moderator privileges
3. **Approved Members List (Kind 34551)**: If the user's pubkey is in the approved members list, they are a member
4. **Banned Members List (Kind 34553)**: If the user's pubkey is in the banned list, they are banned (overrides other statuses)
5. **Declined Members List (Kind 34552)**: If the user's pubkey is in the declined list, their membership was declined
6. **Join Request (Kind 4552)**: If the user has submitted a join request but is not in any other list, their request is pending

### Query Patterns

**Check user membership status:**
```json
{
  "kinds": [34551, 34552, 34553],
  "#d": ["34550:creator_pubkey:community_identifier"],
  "limit": 10
}
```

**Get user's join requests:**
```json
{
  "kinds": [4552],
  "authors": ["user_pubkey"],
  "limit": 50
}
```

**Get user's leave requests:**
```json
{
  "kinds": [4553],
  "authors": ["user_pubkey"],
  "limit": 50
}
```

### Auto-Approval Workflow

Posts from users in the approved members list (Kind 34551) are automatically considered approved without requiring individual Kind 4550 approval events. This reduces moderation overhead for trusted community members.

### Moderation Hierarchy

1. **Community Creator**: Has full control over the community
2. **Moderators**: Listed in the community definition with `["p", pubkey, relay, "moderator"]` tags
3. **Approved Members**: Can post without individual approval
4. **Regular Users**: Posts require moderator approval
5. **Banned Users**: Cannot post, all content hidden

### Client Implementation

Clients SHOULD:
- Check membership status before displaying communities in user interfaces
- Only show communities where the user is a member (approved, moderator, or creator)
- Provide join request functionality for non-members
- Hide content from banned users
- Implement proper permission checks for moderation actions

## Security Considerations

- Member lists should only be updated by community moderators or creators
- Clients should verify moderator permissions before displaying moderation actions
- Banned user lists should be respected across all community interactions
- Join and leave requests should be properly authenticated

## Compatibility

These extensions are designed to be compatible with NIP-72. Clients that implement:

- **Basic NIP-72 only**: Will see community definitions and approvals but not membership management
- **NIP-72 + these extensions**: Will have full membership management functionality

The membership system is designed to be backwards compatible and optional, allowing gradual adoption across the Nostr ecosystem.