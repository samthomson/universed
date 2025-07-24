# Cache Testing Guide

## How to Test Cache Performance

The performance optimizations are now implemented. Here's how to test that caching is working:

### 1. Enable Debug Mode

The app now includes:
- **Performance Dashboard** (enabled by default) - Shows real-time cache metrics
- **Cache Debugger** (development only) - Shows what's in the React Query cache
- **Console Logging** - Shows cache hits/misses in browser console

### 2. Test Scenarios

#### Scenario A: Author Profile Caching
1. Navigate to a page that shows user profiles (messages, comments, etc.)
2. Note the author names/avatars loading
3. Navigate away and back to the same page
4. **Expected:** Author profiles should load instantly from cache
5. **Check:** Console should show "🎯 Cache HIT" messages

#### Scenario B: Message Caching  
1. Open a community chat channel
2. Let messages load completely
3. Navigate to another channel, then back
4. **Expected:** Messages should appear immediately
5. **Check:** Performance dashboard should show improved cache hit rate

#### Scenario C: Community Data Caching
1. Browse different communities
2. Return to previously visited communities
3. **Expected:** Community data loads instantly
4. **Check:** Cache debugger shows queries with data

### 3. Performance Dashboard Metrics

Look for these improvements:
- **Cache Hit Rate:** Should increase from ~1% to 40-80% with repeated navigation
- **Average Load Time:** Should decrease significantly for cached content
- **Background Loads:** Should show 10-50 background optimizations
- **Performance Rating:** Should improve from "Poor" to "Good/Excellent"

### 4. Console Debugging

Open browser console to see:
```
🎯 Cache HIT for ["author","pubkey123"]...
🌐 Cache MISS for ["messages","community123","general"]... (1250ms)
🎯 Cache HIT for ["author","pubkey456"]...
```

### 5. Cache Debugger (Development)

In development mode, the top-left debug panel shows:
- Total queries in cache
- Queries with data
- Individual query status (stale/fresh)

### 6. What Should Be Cached

These queries should show cache hits on repeat visits:
- **Author profiles** (`["author", "pubkey"]`) - 10 minute cache
- **Messages** (`["messages", "communityId", "channelId"]`) - 2 minute cache  
- **Communities** (`["communities"]`) - 5 minute cache
- **User communities** (`["user-communities"]`) - 5 minute cache

### 7. Troubleshooting

If you're not seeing cache hits:

1. **Check staleTime:** Data might be considered stale and refetching
2. **Check navigation:** Make sure you're returning to the exact same page/data
3. **Check console:** Look for cache hit/miss logs
4. **Check debug panel:** Verify queries are actually cached

### 8. Expected Performance Improvements

With proper caching, you should see:
- **60-80% cache hit rate** for repeated navigation
- **Sub-second load times** for cached content
- **Smooth navigation** between previously visited pages
- **Reduced network requests** (visible in Network tab)

### 9. Real-World Testing

Best test scenario:
1. Join/create a community
2. Browse different channels
3. View user profiles by clicking on names
4. Navigate between channels repeatedly
5. Check performance metrics after 5-10 minutes of usage

The cache should accumulate data and subsequent navigation should become noticeably faster.

## Current Implementation Status

✅ **React Query Configuration** - Optimized for better caching
✅ **Performance Monitoring** - Real-time metrics and debugging
✅ **Author Profile Caching** - 10-minute cache with immediate serving
✅ **Message Caching** - 2-minute cache with background refresh
✅ **Smart Prefetching** - Background loading of likely-needed data
✅ **Cache Debugging** - Visual feedback on cache status
✅ **Query Optimization** - Reduced timeouts and better retry logic

The system is designed to show immediate improvements in cache hit rates as you navigate through the app repeatedly.