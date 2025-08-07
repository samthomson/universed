# Optimized Query Tiers System

## Overview

The Optimized Query Tiers system implements a prioritized, multi-stage loading strategy that ensures the most critical user data (DMs + User Communities) loads first, followed by community metadata, then background content. This significantly improves perceived performance and user experience.

## Query Tier Architecture

### 🚀 TIER 1: CRITICAL (Highest Priority)
**Goal**: Load essential user communication data immediately
**Timeout**: 1-1.5 seconds per operation
**Content**: Direct Messages + User Community Metadata

#### 1A: Direct Messages Preload
- **What**: Both sent and received encrypted DMs (kinds 4, 1059)
- **Priority**: Ultra-high - users expect immediate access to conversations
- **Optimization**: Single combined query for sent/received DMs
- **Timeout**: 1 second (aggressive)
- **Limit**: 100 events total (50 sent + 50 received)
- **Cache**: Immediate event caching

#### 1B: User Community Metadata
- **What**: Community definitions for user's communities (kind 34550)
- **Priority**: High - needed for community navigation
- **Optimization**: Single query for top 5 communities
- **Timeout**: 1.5 seconds
- **Limit**: 5 communities max
- **Ordering**: Prioritized by membership status (owner > moderator > approved)

### ⚡ TIER 2: HIGH (High Priority)
**Goal**: Load community structure data
**Timeout**: 1.5-2 seconds per operation
**Content**: Community Channels & Spaces

#### 2A: Community Channels
- **What**: Channel definitions for top communities (kind 32807)
- **Priority**: High - needed for community interaction
- **Optimization**: Parallel queries for top 3 communities
- **Timeout**: 2 seconds
- **Limit**: 15 channels per community
- **Processing**: Includes default "general" channel + custom channels

#### 2B: Community Spaces
- **What**: Space definitions for top communities (kind 39097)
- **Priority**: High - needed for marketplace/resources
- **Optimization**: Parallel queries with default space fallback
- **Timeout**: 1.5 seconds
- **Limit**: 10 spaces per community
- **Processing**: Merges default spaces with custom configurations

### 📊 TIER 3: MEDIUM (Medium Priority)
**Goal**: Load recent content for immediate viewing
**Timeout**: 2.5 seconds
**Content**: Recent Messages

#### 3A: Recent Messages
- **What**: Recent messages for top community's general channel
- **Priority**: Medium - nice to have for immediate content
- **Optimization**: Single community focus (top community only)
- **Timeout**: 2.5 seconds
- **Limit**: 25 messages max
- **Filtering**: Excludes replies, focuses on general channel

## Performance Characteristics

### Timing Strategy
```
TIER 1: 0-1.5s    (Critical: DMs + Communities)
TIER 2: 1.7-3.5s  (High: Channels + Spaces)  
TIER 3: 3.8-6s    (Medium: Recent Messages)
```

### Timeout Aggressiveness
- **Tier 1**: Ultra-aggressive (1-1.5s) - Fail fast to maintain responsiveness
- **Tier 2**: Aggressive (1.5-2s) - Balance speed with completeness
- **Tier 3**: Moderate (2.5s) - Allow more time for content loading

### Query Optimization Techniques

#### 1. Combined Queries
```typescript
// Instead of separate queries:
const sentDMs = await nostr.query([{ kinds: [4, 1059], authors: [user.pubkey] }]);
const receivedDMs = await nostr.query([{ kinds: [4, 1059], '#p': [user.pubkey] }]);

// Use combined query:
const allDMs = await nostr.query([
  { kinds: [4, 1059], authors: [user.pubkey], limit: 50 },
  { kinds: [4, 1059], '#p': [user.pubkey], limit: 50 }
]);
```

#### 2. Parallel Processing
```typescript
// Process communities in parallel within tier
await Promise.all(
  topCommunities.map(async (community) => {
    const channels = await loadCommunityChannels(community.id);
    const spaces = await loadCommunitySpaces(community.id);
    return { community, channels, spaces };
  })
);
```

#### 3. Smart Limits
- **DMs**: 100 total (50 sent + 50 received) - Recent conversations
- **Communities**: 5 max - User's most important communities
- **Channels**: 15 per community - Reasonable channel count
- **Spaces**: 10 per community - Typical space configuration
- **Messages**: 25 max - Recent content only

#### 4. Priority-Based Ordering
```typescript
const prioritizedCommunities = userCommunities.sort((a, b) => {
  const statusOrder = { owner: 0, moderator: 1, approved: 2 };
  return statusOrder[a.membershipStatus] - statusOrder[b.membershipStatus];
});
```

## Integration Points

### App Component Integration
```typescript
// In App.tsx
function AppContent() {
  // Enable optimized query tiers
  useEnableOptimizedQueryTiers();
  
  // Existing preloaders still run for comprehensive coverage
  useHighPriorityChannelPreloader();
  useHighPrioritySpacesPreloader();
  useUserCommunitiesChannelPreloader();
  
  // ... rest of component
}
```

### Coordination with Existing Systems

#### With High-Priority Preloaders
- **Optimized Tiers**: Focused on speed and critical data
- **Existing Preloaders**: Comprehensive coverage and fallback
- **Synergy**: Optimized tiers get critical data fast, existing preloaders ensure completeness

#### With Strategic Background Loader
- **Optimized Tiers**: Immediate, priority-based loading
- **Strategic Loader**: Idle-time, comprehensive loading
- **Handoff**: Optimized tiers handle initial load, strategic loader handles ongoing updates

## Monitoring and Debugging

### Status API
```typescript
const { getTierStatus } = useOptimizedQueryTiers();

const status = getTierStatus();
console.log('Tier Status:', {
  currentTier: status.currentTier,
  tier1Complete: status.tier1Complete,
  tier2Complete: status.tier2Complete,
  tier3Complete: status.tier3Complete,
  metrics: status.metrics,
  totalTime: status.totalTime
});
```

### Logging Output
```
🚀 TIER 1: Starting critical preload (DMs + User Communities)
✅ TIER 1A: Preloaded 47 DM events in 823ms
✅ TIER 1B: Preloaded 3 community metadata events in 1245ms
🎯 TIER 1 COMPLETE: 2/2 operations successful, 50 events in 1342ms

⚡ TIER 2: Starting high priority preload (Channels & Spaces)
✅ TIER 2A: Preloaded channels for 3 communities in 1876ms
✅ TIER 2B: Preloaded spaces for 3 communities in 923ms
⚡ TIER 2 COMPLETE: 2/2 operations successful, 28 events in 2101ms

📊 TIER 3: Starting medium priority preload (Recent Messages)
✅ TIER 3: Preloaded 18 recent messages for 34550:abc123:def456 in 2134ms
📊 TIER 3 COMPLETE: 1/1 operations successful, 18 events in 2134ms

🎉 OPTIMIZED TIERS COMPLETE in 5789ms
```

## Error Handling and Resilience

### Tier Independence
- Each tier operates independently
- Failure in one tier doesn't block others
- Graceful degradation with partial success

### Abort Control
```typescript
// Automatic abort on user activity or component unmount
useEffect(() => {
  return () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };
}, [user?.pubkey]);
```

### Retry Mechanism
```typescript
const { retryTier } = useOptimizedQueryTiers();

// Retry specific tier if needed
await retryTier(1); // Retry DMs + Communities
await retryTier(2); // Retry Channels + Spaces
await retryTier(3); // Retry Recent Messages
```

## Performance Impact

### Before Optimization
```
Page Load → All queries start simultaneously → Relay overwhelmed → Slow initial render
```

### After Optimization
```
Page Load → Tier 1 (DMs + Communities) → Fast initial content → Tier 2 → Tier 3
```

### Expected Improvements
- **Time to First DM**: 1-2 seconds (was 3-5 seconds)
- **Time to Community List**: 1.5-2.5 seconds (was 4-6 seconds)
- **Time to Channel Navigation**: 2-3.5 seconds (was 5-8 seconds)
- **Perceived Performance**: Significantly improved due to progressive loading
- **Relay Load**: Reduced due to staged, prioritized queries

## Configuration and Tuning

### Timeout Adjustments
```typescript
// In useOptimizedQueryTiers.ts
const TIER_1_TIMEOUT = 1000;    // DMs: 1 second
const TIER_1B_TIMEOUT = 1500;   // Communities: 1.5 seconds
const TIER_2_TIMEOUT = 2000;    // Channels: 2 seconds
const TIER_2B_TIMEOUT = 1500;   // Spaces: 1.5 seconds
const TIER_3_TIMEOUT = 2500;    // Messages: 2.5 seconds
```

### Limit Adjustments
```typescript
const DM_LIMIT = 100;           // Total DMs to fetch
const COMMUNITY_LIMIT = 5;      // Communities to process
const CHANNEL_LIMIT = 15;       // Channels per community
const SPACE_LIMIT = 10;         // Spaces per community
const MESSAGE_LIMIT = 25;       // Recent messages
```

### Priority Adjustments
```typescript
// Membership status priority
const statusOrder = {
  owner: 0,      // Highest priority
  moderator: 1,  // Medium priority
  approved: 2    // Lower priority
};
```

## Future Enhancements

### Adaptive Timeouts
- Dynamically adjust timeouts based on network conditions
- Monitor relay response times and adapt accordingly

### User Behavior Learning
- Track user's most frequently accessed communities
- Prioritize communities based on usage patterns

### Cache-Aware Loading
- Skip tiers if data is already fresh in cache
- Intelligently invalidate stale cache entries

### Progressive Enhancement
- Add more tiers for specific use cases
- Implement tier dependencies and prerequisites

## Conclusion

The Optimized Query Tiers system provides a sophisticated, priority-based loading strategy that significantly improves the user experience by ensuring the most critical data loads first. By staging queries and implementing aggressive timeouts, the system delivers a responsive interface while maintaining comprehensive data coverage through coordination with existing preloading systems.