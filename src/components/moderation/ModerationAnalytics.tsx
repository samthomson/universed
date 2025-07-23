import { useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Users, Flag, Shield, Clock, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useModerationStats } from '@/hooks/useModerationLogs';
import { useReports } from '@/hooks/useReporting';
import { useCommunityMembers } from '@/hooks/useCommunityMembers';
import { Skeleton } from '@/components/ui/skeleton';

interface ModerationAnalyticsProps {
  communityId: string;
}

interface MetricCardProps {
  title: string;
  value: number;
  change?: number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

function MetricCard({ title, value, change, icon, trend }: MetricCardProps) {
  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-3 w-3" />;
      case 'down': return <TrendingDown className="h-3 w-3" />;
      default: return null;
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value.toLocaleString()}</p>
            {change !== undefined && (
              <div className={`flex items-center gap-1 text-sm ${getTrendColor()}`}>
                {getTrendIcon()}
                <span>{Math.abs(change)}% from last period</span>
              </div>
            )}
          </div>
          <div className="text-muted-foreground">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export function ModerationAnalytics({ communityId }: ModerationAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const moderationStats = useModerationStats(communityId);
  const { data: reports, isLoading: isLoadingReports } = useReports(communityId);
  const { data: members, isLoading: isLoadingMembers } = useCommunityMembers(communityId);

  const isLoading = isLoadingReports || isLoadingMembers;

  if (isLoading) {
    return <AnalyticsSkeleton />;
  }

  // Calculate time-based metrics
  const now = Math.floor(Date.now() / 1000);
  const timeRangeSeconds = {
    '7d': 7 * 24 * 60 * 60,
    '30d': 30 * 24 * 60 * 60,
    '90d': 90 * 24 * 60 * 60,
  }[timeRange];

  const cutoffTime = now - timeRangeSeconds;

  const recentReports = reports?.filter(report => report.createdAt >= cutoffTime) || [];
  const recentActions = moderationStats?.recentActions.filter(action => action.createdAt >= cutoffTime) || [];

  // Calculate metrics
  const totalMembers = members?.length || 0;
  const totalReports = recentReports.length;
  const totalActions = recentActions.length;
  const responseTime = totalReports > 0 ? Math.round((totalActions / totalReports) * 100) : 0;

  // Calculate trends (simplified - comparing to previous period)
  const previousCutoff = cutoffTime - timeRangeSeconds;
  const previousReports = reports?.filter(report =>
    report.createdAt >= previousCutoff && report.createdAt < cutoffTime
  ) || [];
  const previousActions = moderationStats?.recentActions.filter(action =>
    action.createdAt >= previousCutoff && action.createdAt < cutoffTime
  ) || [];

  const reportsTrend = previousReports.length > 0
    ? ((totalReports - previousReports.length) / previousReports.length) * 100
    : 0;
  const actionsTrend = previousActions.length > 0
    ? ((totalActions - previousActions.length) / previousActions.length) * 100
    : 0;

  // Group reports by type
  const reportsByType = recentReports.reduce((acc, report) => {
    acc[report.reportType] = (acc[report.reportType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Group actions by type
  const actionsByType = recentActions.reduce((acc, action) => {
    acc[action.action] = (acc[action.action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calculate daily activity
  const dailyActivity = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayStart = Math.floor(date.setHours(0, 0, 0, 0) / 1000);
    const dayEnd = Math.floor(date.setHours(23, 59, 59, 999) / 1000);

    const dayReports = recentReports.filter(r => r.createdAt >= dayStart && r.createdAt <= dayEnd).length;
    const dayActions = recentActions.filter(a => a.createdAt >= dayStart && a.createdAt <= dayEnd).length;

    return {
      date: date.toLocaleDateString('en-US', { weekday: 'short' }),
      reports: dayReports,
      actions: dayActions,
    };
  }).reverse();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Moderation Analytics
            </CardTitle>
            <Select value={timeRange} onValueChange={(value) => setTimeRange(value as '7d' | '30d' | '90d')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Members"
          value={totalMembers}
          icon={<Users className="h-8 w-8" />}
        />
        <MetricCard
          title="Reports Received"
          value={totalReports}
          change={Math.abs(reportsTrend)}
          trend={reportsTrend > 0 ? 'up' : reportsTrend < 0 ? 'down' : 'neutral'}
          icon={<Flag className="h-8 w-8" />}
        />
        <MetricCard
          title="Actions Taken"
          value={totalActions}
          change={Math.abs(actionsTrend)}
          trend={actionsTrend > 0 ? 'up' : actionsTrend < 0 ? 'down' : 'neutral'}
          icon={<Shield className="h-8 w-8" />}
        />
        <MetricCard
          title="Response Rate"
          value={responseTime}
          icon={<Clock className="h-8 w-8" />}
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Daily Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dailyActivity.map((day, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{day.date}</span>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <span className="text-sm">{day.reports} reports</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="text-sm">{day.actions} actions</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Average reports per day</span>
                  <Badge variant="outline">
                    {(totalReports / (timeRangeSeconds / (24 * 60 * 60))).toFixed(1)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Most common report type</span>
                  <Badge variant="outline">
                    {Object.entries(reportsByType).sort(([,a], [,b]) => b - a)[0]?.[0] || 'None'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Most common action</span>
                  <Badge variant="outline">
                    {Object.entries(actionsByType).sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || 'None'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Resolution rate</span>
                  <Badge variant="outline">
                    {totalReports > 0 ? Math.round((totalActions / totalReports) * 100) : 0}%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reports by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(reportsByType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">{type}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${(count / totalReports) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm w-8 text-right">{count as number}</span>
                    </div>
                  </div>
                ))}
                {Object.keys(reportsByType).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No reports in the selected time period
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Actions by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(actionsByType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">{type}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${((count as number) / totalActions) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
                {Object.keys(actionsByType).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No actions taken in the selected time period
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trend Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Report Trends</h4>
                  <div className={`flex items-center gap-2 ${reportsTrend > 0 ? 'text-red-600' : reportsTrend < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {reportsTrend > 0 ? <TrendingUp className="h-4 w-4" /> : reportsTrend < 0 ? <TrendingDown className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                    <span className="text-sm">
                      {reportsTrend > 0 ? 'Increased' : reportsTrend < 0 ? 'Decreased' : 'No change'} by {Math.abs(reportsTrend).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Action Trends</h4>
                  <div className={`flex items-center gap-2 ${actionsTrend > 0 ? 'text-blue-600' : actionsTrend < 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                    {actionsTrend > 0 ? <TrendingUp className="h-4 w-4" /> : actionsTrend < 0 ? <TrendingDown className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                    <span className="text-sm">
                      {actionsTrend > 0 ? 'Increased' : actionsTrend < 0 ? 'Decreased' : 'No change'} by {Math.abs(actionsTrend).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-3">Insights</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {totalReports === 0 && (
                    <p>• No reports received in this period - community is well-moderated</p>
                  )}
                  {totalReports > 0 && totalActions === 0 && (
                    <p>• Reports received but no actions taken - consider reviewing pending reports</p>
                  )}
                  {totalActions > totalReports && (
                    <p>• More actions than reports - proactive moderation is working well</p>
                  )}
                  {reportsTrend > 20 && (
                    <p>• Significant increase in reports - may need additional moderation resources</p>
                  )}
                  {actionsTrend > 20 && (
                    <p>• Increased moderation activity - good response to community needs</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}