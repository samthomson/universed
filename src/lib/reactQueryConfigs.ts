/**
 * Centralized React Query configurations
 * These settings control caching behavior across the application
 */
export const reactQueryConfigs = {
  author: {
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
  },
  messages: {
    staleTime: 60 * 1000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  },
  communities: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  },
  events: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  },
  reactions: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  },
  'pinned-messages': {
    staleTime: 60 * 1000, // 1 minute - similar to messages
    gcTime: 10 * 60 * 1000, // 10 minutes - similar to messages
  },
  'pinned-messages-events': {
    staleTime: 60 * 1000, // 1 minute - similar to messages
    gcTime: 10 * 60 * 1000, // 10 minutes - similar to messages
  },
  'thread-replies': {
    staleTime: 60 * 1000, // 1 minute - similar to messages
    gcTime: 10 * 60 * 1000, // 10 minutes - similar to messages
  },
  'user-status': {
    staleTime: 30 * 1000, // 30 seconds - needs to be fresh for presence
    gcTime: 5 * 60 * 1000, // 5 minutes - similar to reactions
  },
} as const;