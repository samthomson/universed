import { useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';

interface PerformanceMetrics {
  cacheHits: number;
  cacheMisses: number;
  backgroundLoads: number;
  preloads: number;
  totalQueries: number;
  averageLoadTime: number;
  lastResetTime: number;
}

interface LoadTimeEntry {
  queryKey: string;
  startTime: number;
  endTime: number;
  duration: number;
  wasFromCache: boolean;
}

/**
 * Hook for monitoring performance of our caching and background loading optimizations.
 * Provides metrics to understand the effectiveness of our performance improvements.
 */
export function usePerformanceMonitor() {
  const queryClient = useQueryClient();

  const metricsRef = useRef<PerformanceMetrics>({
    cacheHits: 0,
    cacheMisses: 0,
    backgroundLoads: 0,
    preloads: 0,
    totalQueries: 0,
    averageLoadTime: 0,
    lastResetTime: Date.now(),
  });

  const loadTimesRef = useRef<LoadTimeEntry[]>([]);
  const queryStartTimes = useRef<Map<string, number>>(new Map());

  // Track query start
  const trackQueryStart = useCallback((queryKey: string) => {
    queryStartTimes.current.set(queryKey, performance.now());
  }, []);

  // Track query completion
  const trackQueryEnd = useCallback((queryKey: string, wasFromCache: boolean = false) => {
    const startTime = queryStartTimes.current.get(queryKey);
    if (!startTime && !wasFromCache) return; // Only require start time for non-cached queries

    const endTime = performance.now();
    const duration = startTime ? endTime - startTime : 0;

    const entry: LoadTimeEntry = {
      queryKey,
      startTime: startTime || endTime,
      endTime,
      duration,
      wasFromCache,
    };

    loadTimesRef.current.push(entry);
    if (startTime) {
      queryStartTimes.current.delete(queryKey);
    }

    // Update metrics
    const metrics = metricsRef.current;
    metrics.totalQueries++;

    if (wasFromCache) {
      metrics.cacheHits++;
      logger.log(`🎯 Cache HIT for ${queryKey.substring(0, 50)}...`);
    } else {
      metrics.cacheMisses++;
      logger.log(`🌐 Cache MISS for ${queryKey.substring(0, 50)}... (${duration.toFixed(0)}ms)`);
    }

    // Update average load time (only count non-cached queries for realistic timing)
    const recentEntries = loadTimesRef.current.slice(-100); // Keep last 100 entries
    const nonCachedEntries = recentEntries.filter(entry => !entry.wasFromCache);
    if (nonCachedEntries.length > 0) {
      const totalDuration = nonCachedEntries.reduce((sum, entry) => sum + entry.duration, 0);
      metrics.averageLoadTime = totalDuration / nonCachedEntries.length;
    }

    // Keep only recent entries to prevent memory bloat
    if (loadTimesRef.current.length > 200) {
      loadTimesRef.current = loadTimesRef.current.slice(-100);
    }
  }, []);

  // Track background load
  const trackBackgroundLoad = useCallback(() => {
    metricsRef.current.backgroundLoads++;
  }, []);

  // Track preload
  const trackPreload = useCallback(() => {
    metricsRef.current.preloads++;
  }, []);

  // Get current metrics
  const getMetrics = useCallback((): PerformanceMetrics & {
    cacheHitRate: number;
    recentLoadTimes: LoadTimeEntry[];
  } => {
    const metrics = metricsRef.current;
    const cacheHitRate = metrics.totalQueries > 0
      ? metrics.cacheHits / metrics.totalQueries
      : 0;

    return {
      ...metrics,
      cacheHitRate,
      recentLoadTimes: loadTimesRef.current.slice(-20), // Last 20 load times
    };
  }, []);

  // Reset metrics
  const resetMetrics = useCallback(() => {
    metricsRef.current = {
      cacheHits: 0,
      cacheMisses: 0,
      backgroundLoads: 0,
      preloads: 0,
      totalQueries: 0,
      averageLoadTime: 0,
      lastResetTime: Date.now(),
    };
    loadTimesRef.current = [];
    queryStartTimes.current.clear();
  }, []);

  // Classify performance based on metrics
  const getPerformanceRating = useCallback((metrics: PerformanceMetrics & { cacheHitRate: number }) => {
    const { cacheHitRate, averageLoadTime } = metrics;

    if (cacheHitRate > 0.8 && averageLoadTime < 200) {
      return 'Excellent';
    } else if (cacheHitRate > 0.6 && averageLoadTime < 500) {
      return 'Good';
    } else if (cacheHitRate > 0.4 && averageLoadTime < 1000) {
      return 'Fair';
    } else {
      return 'Poor';
    }
  }, []);

  // Get performance summary
  const getPerformanceSummary = useCallback(() => {
    const metrics = getMetrics();
    const now = Date.now();
    const timeSinceReset = now - metrics.lastResetTime;
    const hoursElapsed = timeSinceReset / (1000 * 60 * 60);

    return {
      // Cache effectiveness
      cacheHitRate: `${(metrics.cacheHitRate * 100).toFixed(1)}%`,
      cacheHits: metrics.cacheHits,
      cacheMisses: metrics.cacheMisses,

      // Performance
      averageLoadTime: `${metrics.averageLoadTime.toFixed(0)}ms`,
      totalQueries: metrics.totalQueries,
      queriesPerHour: hoursElapsed > 0 ? Math.round(metrics.totalQueries / hoursElapsed) : 0,

      // Background optimizations
      backgroundLoads: metrics.backgroundLoads,
      preloads: metrics.preloads,

      // Time period
      monitoringDuration: `${Math.round(timeSinceReset / 1000)}s`,

      // Performance classification
      performanceRating: getPerformanceRating(metrics),
    };
  }, [getMetrics, getPerformanceRating]);

  // Monitor query cache for automatic tracking
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (!event?.query?.queryKey) return;

      const queryKey = JSON.stringify(event.query.queryKey);
      const query = event.query;

      switch (event.type) {
        case 'observerAdded':
          // Query observer added - check if data already exists
          if (query.state.data !== undefined && query.state.status === 'success') {
            // This is an immediate cache hit
            trackQueryStart(queryKey);
            trackQueryEnd(queryKey, true);
          } else if (query.state.status === 'pending') {
            // Query is fetching - track start
            trackQueryStart(queryKey);
          }
          break;

        case 'updated':
          // Query state updated
          if (event.query.state.status === 'success') {
            // Query completed successfully
            const queryStartTime = queryStartTimes.current.get(queryKey);
            if (queryStartTime) {
              // We tracked the start, so this is a network fetch
              trackQueryEnd(queryKey, false);
            }
          }
          break;
      }
    });

    return unsubscribe;
  }, [queryClient, trackQueryStart, trackQueryEnd]);

  // Log performance summary periodically in development
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const interval = setInterval(() => {
      const summary = getPerformanceSummary();
      if (summary.totalQueries > 0) {
        logger.log('🚀 Performance Summary:', summary);
      }
    }, 30000); // Log every 30 seconds

    return () => clearInterval(interval);
  }, [getPerformanceSummary]);

  return {
    trackQueryStart,
    trackQueryEnd,
    trackBackgroundLoad,
    trackPreload,
    getMetrics,
    getPerformanceSummary,
    resetMetrics,
  };
}

/**
 * Lightweight hook that just enables performance monitoring without exposing controls.
 */
export function useEnablePerformanceMonitoring() {
  usePerformanceMonitor();
}