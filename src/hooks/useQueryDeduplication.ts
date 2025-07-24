import { useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { NostrFilter } from '@nostrify/nostrify';

interface PendingQuery<T = unknown> {
  promise: Promise<T>;
  timestamp: number;
  filters: NostrFilter[];
}

const DEDUPLICATION_WINDOW = 1000; // 1 second window for deduplication
const MAX_PENDING_QUERIES = 50; // Limit concurrent queries

/**
 * Hook that deduplicates similar Nostr queries to reduce relay load
 * and improve cache hit rates by preventing redundant requests.
 */
export function useQueryDeduplication() {
  const queryClient = useQueryClient();
  const pendingQueries = useRef<Map<string, PendingQuery>>(new Map());

  // Generate a cache key for a set of filters
  const generateFilterKey = useCallback((filters: NostrFilter[]): string => {
    // Sort filters and their properties for consistent keys
    const normalizedFilters = filters.map(filter => {
      const sorted: Record<string, unknown> = {};
      Object.keys(filter).sort().forEach(key => {
        const value = filter[key as keyof NostrFilter];
        if (Array.isArray(value)) {
          sorted[key] = [...value].sort();
        } else {
          sorted[key] = value;
        }
      });
      return sorted;
    });

    return JSON.stringify(normalizedFilters);
  }, []);

  // Check if a query is similar enough to deduplicate
  const isSimilarQuery = useCallback((filters1: NostrFilter[], filters2: NostrFilter[]): boolean => {
    if (filters1.length !== filters2.length) return false;

    return filters1.every((filter1, index) => {
      const filter2 = filters2[index];
      if (!filter2) return false;

      // Check if kinds match
      const kinds1 = filter1.kinds || [];
      const kinds2 = filter2.kinds || [];
      if (kinds1.length !== kinds2.length || !kinds1.every(k => kinds2.includes(k))) {
        return false;
      }

      // Check if authors match (if present)
      const authors1 = filter1.authors || [];
      const authors2 = filter2.authors || [];
      if (authors1.length !== authors2.length || !authors1.every(a => authors2.includes(a))) {
        return false;
      }

      // Check if tag filters match
      const tagKeys1 = Object.keys(filter1).filter(k => k.startsWith('#'));
      const tagKeys2 = Object.keys(filter2).filter(k => k.startsWith('#'));
      if (tagKeys1.length !== tagKeys2.length || !tagKeys1.every(k => tagKeys2.includes(k))) {
        return false;
      }

      for (const tagKey of tagKeys1) {
        const values1 = (filter1[tagKey as keyof NostrFilter] as string[]) || [];
        const values2 = (filter2[tagKey as keyof NostrFilter] as string[]) || [];
        if (values1.length !== values2.length || !values1.every(v => values2.includes(v))) {
          return false;
        }
      }

      return true;
    });
  }, []);

  // Get or create a deduplicated query
  const getDeduplicatedQuery = useCallback(<T>(
    queryKey: string,
    filters: NostrFilter[],
    queryFn: () => Promise<T>
  ): Promise<T> => {
    const now = Date.now();
    const filterKey = generateFilterKey(filters);

    // Clean up old pending queries
    for (const [key, query] of pendingQueries.current.entries()) {
      if (now - query.timestamp > DEDUPLICATION_WINDOW * 2) {
        pendingQueries.current.delete(key);
      }
    }

    // Check for exact match first
    const exactMatch = pendingQueries.current.get(filterKey);
    if (exactMatch && now - exactMatch.timestamp < DEDUPLICATION_WINDOW) {
      return exactMatch.promise as Promise<T>;
    }

    // Check for similar queries
    for (const [_key, query] of pendingQueries.current.entries()) {
      if (now - query.timestamp < DEDUPLICATION_WINDOW &&
          isSimilarQuery(filters, query.filters)) {
        return query.promise as Promise<T>;
      }
    }

    // Limit concurrent queries
    if (pendingQueries.current.size >= MAX_PENDING_QUERIES) {
      // Remove oldest query
      const oldestKey = Array.from(pendingQueries.current.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0]?.[0];
      if (oldestKey) {
        pendingQueries.current.delete(oldestKey);
      }
    }

    // Create new query
    const promise = queryFn().finally(() => {
      // Clean up after completion
      setTimeout(() => {
        pendingQueries.current.delete(filterKey);
      }, DEDUPLICATION_WINDOW);
    });

    pendingQueries.current.set(filterKey, {
      promise,
      timestamp: now,
      filters,
    });

    return promise;
  }, [generateFilterKey, isSimilarQuery]);

  // Check if data exists in cache
  const getCachedData = useCallback(<T>(queryKey: (string | number | boolean | object)[]): T | undefined => {
    return queryClient.getQueryData<T>(queryKey);
  }, [queryClient]);

  // Set data in cache with optimized settings
  const setCachedData = useCallback(<T>(
    queryKey: (string | number | boolean | object)[],
    data: T,
    staleTime?: number
  ) => {
    queryClient.setQueryData(queryKey, data, {
      updatedAt: Date.now(),
    });

    // Set custom stale time if provided
    if (staleTime) {
      queryClient.setQueryDefaults(queryKey, {
        staleTime,
      });
    }
  }, [queryClient]);

  // Prefetch data for better cache hits
  const prefetchQuery = useCallback(<T>(
    queryKey: (string | number | boolean | object)[],
    queryFn: () => Promise<T>,
    staleTime: number = 5 * 60 * 1000 // 5 minutes default
  ) => {
    return queryClient.prefetchQuery({
      queryKey,
      queryFn,
      staleTime,
    });
  }, [queryClient]);

  // Get cache statistics
  const getCacheStats = useCallback(() => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();

    let hits = 0;
    let misses = 0;
    let totalSize = 0;

    queries.forEach(query => {
      if (query.state.data) {
        hits++;
        if (Array.isArray(query.state.data)) {
          totalSize += query.state.data.length;
        } else {
          totalSize += 1;
        }
      } else {
        misses++;
      }
    });

    return {
      totalQueries: queries.length,
      hits,
      misses,
      hitRate: queries.length > 0 ? hits / queries.length : 0,
      totalCachedItems: totalSize,
      pendingQueries: pendingQueries.current.size,
    };
  }, [queryClient]);

  return {
    getDeduplicatedQuery,
    getCachedData,
    setCachedData,
    prefetchQuery,
    getCacheStats,
  };
}