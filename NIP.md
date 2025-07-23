# Community Spaces

This document defines custom Nostr event kinds used by this community application for implementing "spaces" - mini-applications within communities.

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