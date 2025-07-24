import { useState, useEffect } from 'react';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, BarChart3, Zap, X } from 'lucide-react';

/**
 * Development-only component that displays performance metrics.
 * Shows cache hit rates, load times, and optimization effectiveness.
 */
export function PerformanceIndicator() {
  const { getPerformanceSummary, resetMetrics } = usePerformanceMonitor();
  const [isVisible, setIsVisible] = useState(false);
  const [summary, setSummary] = useState(getPerformanceSummary());

  // Only show in development mode
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setIsVisible(true);
    }
  }, []);

  // Update summary periodically
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setSummary(getPerformanceSummary());
    }, 2000);

    return () => clearInterval(interval);
  }, [isVisible, getPerformanceSummary]);

  if (!isVisible || summary.totalQueries === 0) {
    return null;
  }

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'Excellent': return 'bg-green-500';
      case 'Good': return 'bg-blue-500';
      case 'Fair': return 'bg-yellow-500';
      case 'Poor': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Card className="bg-gray-900/95 border-gray-700 text-gray-100 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Performance
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-400 hover:text-gray-200"
              onClick={() => setIsVisible(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          {/* Overall Rating */}
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Rating:</span>
            <Badge className={`${getRatingColor(summary.performanceRating)} text-white`}>
              {summary.performanceRating}
            </Badge>
          </div>

          {/* Cache Performance */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-blue-400" />
              <span className="text-gray-300">Cache Hit Rate:</span>
              <span className="font-mono text-green-400">{summary.cacheHitRate}</span>
            </div>
            <div className="text-gray-400">
              {summary.cacheHits} hits / {summary.cacheMisses} misses
            </div>
          </div>

          {/* Load Performance */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <BarChart3 className="h-3 w-3 text-yellow-400" />
              <span className="text-gray-300">Avg Load:</span>
              <span className="font-mono text-yellow-400">{summary.averageLoadTime}</span>
            </div>
            <div className="text-gray-400">
              {summary.totalQueries} queries ({summary.queriesPerHour}/hr)
            </div>
          </div>

          {/* Background Optimizations */}
          <div className="space-y-1">
            <div className="text-gray-300">Background Optimizations:</div>
            <div className="text-gray-400 pl-2">
              • {summary.backgroundLoads} background loads
            </div>
            <div className="text-gray-400 pl-2">
              • {summary.preloads} preloads
            </div>
          </div>

          {/* Duration */}
          <div className="flex items-center justify-between text-gray-400">
            <span>Duration:</span>
            <span className="font-mono">{summary.monitoringDuration}</span>
          </div>

          {/* Reset Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs border-gray-600 text-gray-300 hover:bg-gray-800"
            onClick={resetMetrics}
          >
            Reset Metrics
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}