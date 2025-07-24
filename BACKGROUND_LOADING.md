# Background Loading System

This document describes the comprehensive background loading and caching system implemented to improve performance and user experience in the Universes Nostr client.

## Overview

The background loading system consists of several interconnected components that work together to:

1. **Preload community events** when the app is idle
2. **Cache events efficiently** to reduce redundant network requests
3. **Batch requests** to minimize relay load
4. **Preload on hover** for instant navigation
5. **Monitor performance** to track optimization effectiveness

## Components

### 1. Background Loader (`useBackgroundLoader`)

**Purpose**: Automatically loads community events in the background when the app is idle.

**Key Features**:
- Waits for 2 seconds of inactivity before starting background loads
- Processes communities in batches of 3 to avoid overwhelming relays
- Prioritizes communities by membership status (owner > moderator > member)
- Implements cooldown periods to prevent excessive loading
- Respects existing cache to avoid redundant requests

**Usage**:
```typescript
// Enable background loading (automatically integrated in DiscordLayout)
useEnableBackgroundLoading();
```

**Configuration**:
- `BACKGROUND_LOAD_DELAY`: 2000ms - Wait time after activity stops
- `BATCH_SIZE`: 3 - Communities loaded simultaneously
- `LOAD_COOLDOWN`: 30000ms - Minimum time between loads for same community
- `MAX_EVENTS_PER_COMMUNITY`: 50 - Event limit per community

### 2. Community Preloader (`useCommunityPreloader`)

**Purpose**: Preloads community data when users hover over community icons or show intent to navigate.

**Key Features**:
- 300ms hover delay to detect genuine intent
- Loads essential data: recent messages, channels, reactions
- Cancels preload if user moves away quickly
- Caches preloaded data for 5 minutes
- Provides immediate and delayed preload options

**Usage**:
```typescript
const { startPreload, cancelPreload, preloadImmediately } = useCommunityPreloader();

// On hover
onMouseEnter={() => startPreload(communityId)}
onMouseLeave={() => cancelPreload(communityId)}

// For high-priority scenarios
preloadImmediately(communityId);
```

### 3. Optimized Event Loading (`useOptimizedEventLoading`)

**Purpose**: Batches and optimizes loading of related events (reactions, comments, replies).

**Key Features**:
- Batches requests for up to 20 events with 500ms delay
- Checks cache before making network requests
- Loads reactions, comments, and replies in single batched query
- Deduplicates events across cached and fresh data
- Provides specialized methods for different event types

**Usage**:
```typescript
const { loadReactions, loadComments, preloadRelatedEvents } = useOptimizedEventLoading();

// Preload related events for message list
preloadRelatedEvents(communityId, messageEvents);

// Load specific event types
const reactions = await loadReactions(communityId, eventIds);
const comments = await loadComments(communityId, eventIds);
```

### 4. Enhanced Event Cache (`useEventCache`)

**Purpose**: Provides intelligent caching of Nostr events with multiple indexing strategies.

**Key Features**:
- Caches events by ID, kind, and author
- Provides cache statistics and hit rate tracking
- Supports bulk operations for better performance
- Includes cache invalidation and cleanup utilities
- Integrates with React Query for persistent caching

**Usage**:
```typescript
const { cacheEvents, getCachedEvent, getCacheStats } = useEventCache();

// Cache multiple events
cacheEvents(events);

// Retrieve cached event
const event = getCachedEvent(eventId);

// Get cache performance stats
const stats = getCacheStats();
```

### 5. Performance Monitor (`usePerformanceMonitor`)

**Purpose**: Tracks the effectiveness of caching and background loading optimizations.

**Key Features**:
- Monitors cache hit rates and load times
- Tracks background loads and preloads
- Provides performance ratings (Excellent/Good/Fair/Poor)
- Logs metrics in development mode
- Offers detailed performance summaries

**Usage**:
```typescript
const { getPerformanceSummary, resetMetrics } = usePerformanceMonitor();

// Get current performance metrics
const summary = getPerformanceSummary();
console.log(`Cache hit rate: ${summary.cacheHitRate}`);
console.log(`Average load time: ${summary.averageLoadTime}`);
```

## Integration Points

### Main Layout Integration

The background loading system is automatically enabled in `DiscordLayout`:

```typescript
// Enable background loading of community events
useEnableBackgroundLoading();

// Enable performance monitoring
useEnablePerformanceMonitoring();
```

### Sidebar Integration

Community preloading is integrated into `AppSidebar` for hover-based preloading:

```typescript
<div 
  onMouseEnter={() => startPreload(community.id)}
  onMouseLeave={() => cancelPreload(community.id)}
>
  {/* Community button */}
</div>
```

### Message Loading Enhancement

The `useMessages` hook is enhanced to utilize cached data and preload related events:

```typescript
// Try cached data first for faster initial load
const cachedMessages = getCachedEventsByKind(1).concat(getCachedEventsByKind(9411));

// Preload related events in background
if (sortedEvents.length > 0) {
  preloadRelatedEvents(communityId, sortedEvents);
}
```

## Performance Benefits

### 1. Reduced Load Times
- **Cache hits**: Instant loading from local cache
- **Background preloading**: Data ready before user navigation
- **Hover preloading**: Sub-second response to user intent

### 2. Reduced Network Traffic
- **Batched requests**: Multiple events loaded in single query
- **Intelligent caching**: Avoids redundant network requests
- **Cooldown periods**: Prevents excessive background loading

### 3. Better User Experience
- **Instant navigation**: Preloaded data provides immediate response
- **Smooth interactions**: Background loading doesn't block UI
- **Progressive enhancement**: System works without breaking existing features

## Monitoring and Debugging

### Development Mode Features

In development mode, the system provides:

1. **Performance Indicator**: Visual overlay showing real-time metrics
2. **Console Logging**: Periodic performance summaries
3. **Cache Statistics**: Detailed cache hit rates and timings

### Performance Metrics

Key metrics tracked:
- **Cache Hit Rate**: Percentage of requests served from cache
- **Average Load Time**: Mean time for data loading operations
- **Background Loads**: Number of automatic background loading operations
- **Preloads**: Number of hover-triggered preload operations

### Performance Ratings

- **Excellent**: >80% cache hit rate, <200ms average load time
- **Good**: >60% cache hit rate, <500ms average load time
- **Fair**: >40% cache hit rate, <1000ms average load time
- **Poor**: Below fair thresholds

## Configuration Options

### Background Loading
```typescript
const BACKGROUND_LOAD_DELAY = 2000; // Inactivity delay
const BATCH_SIZE = 3; // Communities per batch
const LOAD_COOLDOWN = 30000; // Cooldown between loads
const MAX_EVENTS_PER_COMMUNITY = 50; // Event limit
```

### Preloading
```typescript
const PRELOAD_DELAY = 300; // Hover intent delay
const PRELOAD_CACHE_TIME = 5 * 60 * 1000; // Cache duration
```

### Event Batching
```typescript
const BATCH_DELAY = 500; // Request batching delay
const BATCH_SIZE = 20; // Events per batch
const CACHE_DURATION = 2 * 60 * 1000; // Cache duration
```

## Best Practices

### 1. Cache-First Strategy
Always check cache before making network requests:

```typescript
// Check cache first
const cached = getCachedEvent(eventId);
if (cached && isFresh(cached)) {
  return cached;
}

// Fallback to network
const fresh = await fetchFromNetwork(eventId);
```

### 2. Batch Related Requests
Combine related queries for efficiency:

```typescript
// ✅ Good: Single batched query
const events = await nostr.query([{
  kinds: [1, 7, 1111], // Messages, reactions, comments
  '#a': [communityId],
  limit: 100
}]);

// ❌ Bad: Multiple separate queries
const messages = await nostr.query([{ kinds: [1] }]);
const reactions = await nostr.query([{ kinds: [7] }]);
const comments = await nostr.query([{ kinds: [1111] }]);
```

### 3. Respect User Intent
Use appropriate delays to detect genuine user intent:

```typescript
// Hover preloading with intent detection
onMouseEnter={() => startPreload(communityId)} // 300ms delay
onMouseLeave={() => cancelPreload(communityId)} // Cancel if quick movement
```

### 4. Monitor Performance
Regularly check performance metrics to ensure optimizations are effective:

```typescript
// Log performance in development
const summary = getPerformanceSummary();
if (summary.performanceRating === 'Poor') {
  console.warn('Performance optimization needed');
}
```

## Future Enhancements

### Potential Improvements
1. **Adaptive Loading**: Adjust batch sizes based on network conditions
2. **User Behavior Learning**: Prioritize preloading based on user patterns
3. **Relay-Specific Optimization**: Tailor strategies for different relay capabilities
4. **Memory Management**: Implement LRU cache eviction for large datasets
5. **Offline Support**: Cache data for offline access

### Monitoring Enhancements
1. **Real-time Dashboards**: Visual performance monitoring tools
2. **A/B Testing**: Compare optimization strategies
3. **User Experience Metrics**: Track perceived performance improvements
4. **Relay Performance**: Monitor individual relay response times

## Conclusion

The background loading system significantly improves the user experience by:
- Reducing perceived load times through intelligent caching
- Preloading data based on user intent and behavior
- Optimizing network usage through batching and deduplication
- Providing comprehensive monitoring for continuous improvement

The system is designed to be transparent to users while providing substantial performance benefits, especially for users who frequently navigate between communities and channels.