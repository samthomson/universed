import { useState } from 'react';
import { AlertTriangle, Filter, Calendar, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useReports, type ReportType, type Report } from '@/hooks/useReporting';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { Skeleton } from '@/components/ui/skeleton';

interface ReportsPanelProps {
  communityId: string;
}

interface ReportCardProps {
  report: Report;
}

function ReportCard({ report }: ReportCardProps) {
  const author = useAuthor(report.targetPubkey);
  const reporter = useAuthor(report.reporterPubkey);

  const getReportTypeColor = (type: ReportType) => {
    switch (type) {
      case 'spam': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'nudity': return 'bg-red-100 text-red-800 border-red-200';
      case 'illegal': return 'bg-red-100 text-red-800 border-red-200';
      case 'profanity': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'impersonation': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'malware': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getReportTypeIcon = (type: ReportType) => {
    switch (type) {
      case 'spam': return '🚫';
      case 'nudity': return '🔞';
      case 'illegal': return '⚖️';
      case 'profanity': return '🤬';
      case 'impersonation': return '🎭';
      case 'malware': return '🦠';
      default: return '⚠️';
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={author.data?.metadata?.picture} />
              <AvatarFallback>
                {genUserName(report.targetPubkey).slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">
                {author.data?.metadata?.name || genUserName(report.targetPubkey)}
              </div>
              <div className="text-sm text-muted-foreground">
                Reported by {reporter.data?.metadata?.name || genUserName(report.reporterPubkey)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getReportTypeColor(report.reportType)}>
              {getReportTypeIcon(report.reportType)} {report.reportType}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(report.createdAt * 1000).toLocaleDateString()}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {report.reason && (
          <div className="bg-muted p-3 rounded-md mb-3">
            <div className="text-sm font-medium mb-1">Report Details:</div>
            <div className="text-sm">{report.reason}</div>
          </div>
        )}

        {report.targetEventId && (
          <div className="border rounded-md p-3 mb-3">
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Reported Content:
            </div>
            <div className="text-sm text-muted-foreground">
              Event ID: {report.targetEventId}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Report ID: {report.id.slice(0, 16)}...
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline">
              View Details
            </Button>
            <Button size="sm" variant="outline">
              Take Action
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportSkeleton() {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-16 w-full mb-3" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-24" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReportsPanel({ communityId }: ReportsPanelProps) {
  const [filterType, setFilterType] = useState<ReportType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'type'>('newest');

  const { data: reports, isLoading } = useReports(communityId);

  const filteredReports = reports?.filter(report =>
    filterType === 'all' || report.reportType === filterType
  ) || [];

  const sortedReports = [...filteredReports].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return b.createdAt - a.createdAt;
      case 'oldest':
        return a.createdAt - b.createdAt;
      case 'type':
        return a.reportType.localeCompare(b.reportType);
      default:
        return 0;
    }
  });

  const reportStats = reports?.reduce((acc, report) => {
    acc[report.reportType] = (acc[report.reportType] || 0) + 1;
    return acc;
  }, {} as Partial<Record<ReportType, number>>) || {};

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Reports</CardTitle>
          </CardHeader>
        </Card>
        {Array.from({ length: 3 }).map((_, i) => (
          <ReportSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Reports
            </span>
            <Badge variant={filteredReports.length > 0 ? 'destructive' : 'secondary'}>
              {filteredReports.length} total
            </Badge>
          </CardTitle>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <Select value={filterType} onValueChange={(value) => setFilterType(value as ReportType | 'all')}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reports</SelectItem>
                  <SelectItem value="spam">Spam ({reportStats.spam || 0})</SelectItem>
                  <SelectItem value="nudity">Nudity ({reportStats.nudity || 0})</SelectItem>
                  <SelectItem value="profanity">Profanity ({reportStats.profanity || 0})</SelectItem>
                  <SelectItem value="illegal">Illegal ({reportStats.illegal || 0})</SelectItem>
                  <SelectItem value="impersonation">Impersonation ({reportStats.impersonation || 0})</SelectItem>
                  <SelectItem value="malware">Malware ({reportStats.malware || 0})</SelectItem>
                  <SelectItem value="other">Other ({reportStats.other || 0})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'newest' | 'oldest' | 'type')}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="type">Type</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Report Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(reportStats).map(([type, count]) => (
          <Card key={type}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-sm text-muted-foreground capitalize">{type}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reports List */}
      {sortedReports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No reports found</h3>
            <p className="text-muted-foreground">
              {filterType === 'all'
                ? 'No reports have been submitted for this community.'
                : `No ${filterType} reports found.`
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedReports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}