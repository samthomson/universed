/**
 * Centralized React Query configurations
 * These settings control caching behavior across the application
 * OPTIMIZED: More aggressive caching to reduce network requests
 */
export const reactQueryConfigs = {
  author: {
    staleTime: 30 * 60 * 1000, // 30 minutes (increased from 15)
    gcTime: 4 * 60 * 60 * 1000, // 4 hours (increased from 2)
  },
  messages: {
    staleTime: 2 * 60 * 1000, // 2 minutes (increased from 1)
    gcTime: 20 * 60 * 1000, // 20 minutes (increased from 10)
  },
  communities: {
    staleTime: 10 * 60 * 1000, // 10 minutes (increased from 5)
    gcTime: 60 * 60 * 1000, // 1 hour (increased from 30)
  },
  events: {
    staleTime: 20 * 60 * 1000, // 20 minutes (increased from 10)
    gcTime: 2 * 60 * 60 * 1000, // 2 hours (increased from 1)
  },
  reactions: {
    staleTime: 2 * 60 * 1000, // 2 minutes (increased from 30 seconds)
    gcTime: 10 * 60 * 1000, // 10 minutes (increased from 5)
  },
  'pinned-messages': {
    staleTime: 2 * 60 * 1000, // 2 minutes (increased from 1)
    gcTime: 20 * 60 * 1000, // 20 minutes (increased from 10)
  },
  'pinned-messages-events': {
    staleTime: 2 * 60 * 1000, // 2 minutes (increased from 1)
    gcTime: 20 * 60 * 1000, // 20 minutes (increased from 10)
  },
  'thread-replies': {
    staleTime: 2 * 60 * 1000, // 2 minutes (increased from 1)
    gcTime: 20 * 60 * 1000, // 20 minutes (increased from 10)
  },
  'user-status': {
    staleTime: 2 * 60 * 1000, // 2 minutes (increased from 30 seconds)
    gcTime: 10 * 60 * 1000, // 10 minutes (increased from 5)
  },
  // New batch query configurations
  'user-status-batch': {
    staleTime: 3 * 60 * 1000, // 3 minutes for batch queries
    gcTime: 15 * 60 * 1000, // 15 minutes
  },
  'reactions-and-zaps-batch': {
    staleTime: 90 * 1000, // 90 seconds for batch reactions/zaps
    gcTime: 10 * 60 * 1000, // 10 minutes
  },
} as const;