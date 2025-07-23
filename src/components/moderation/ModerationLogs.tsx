import { useState } from 'react';
import { Clock, Filter, Shield, Ban, VolumeX, Trash2, CheckCircle, Pin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useModerationLogs, type ModerationAction } from '@/hooks/useModerationLogs';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { Skeleton } from '@/components/ui/skeleton';

interface ModerationLogsProps {
  communityId: string;
}

interface LogEntryProps {
  action: ModerationAction;
}

function LogEntry({ action }: LogEntryProps) {
  const moderator = useAuthor(action.moderatorPubkey);
  const target = useAuthor(action.targetPubkey || '');

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'ban': return <Ban className="h-4 w-4 text-red-500" />;
      case 'mute': return <VolumeX className="h-4 w-4 text-orange-500" />;
      case 'delete': return <Trash2 className="h-4 w-4 text-red-500" />;
      case 'approve': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pin': return <Pin className="h-4 w-4 text-blue-500" />;
      case 'unpin': return <Pin className="h-4 w-4 text-gray-500" />;
      case 'warn': return <Shield className="h-4 w-4 text-yellow-500" />;
      default: return <Shield className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'ban': return 'bg-red-100 text-red-800 border-red-200';
      case 'mute': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'delete': return 'bg-red-100 text-red-800 border-red-200';
      case 'approve': return 'bg-green-100 text-green-800 border-green-200';
      case 'pin': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'unpin': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'warn': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Permanent';

    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const isExpired = action.expiresAt && action.expiresAt < Math.floor(Date.now() / 1000);

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={moderator.data?.metadata?.picture} />
              <AvatarFallback>
                {genUserName(action.moderatorPubkey).slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {getActionIcon(action.action)}
                <span className="font-medium">
                  {moderator.data?.metadata?.name || genUserName(action.moderatorPubkey)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {action.action}ed
                </span>
                {action.targetPubkey && (
                  <>
                    <span className="text-sm text-muted-foreground">user</span>
                    <span className="font-medium">
                      {target.data?.metadata?.name || genUserName(action.targetPubkey)}
                    </span>
                  </>
                )}
                {action.targetEventId && (
                  <>
                    <span className="text-sm text-muted-foreground">post</span>
                    <code className="text-xs bg-muted px-1 rounded">
                      {action.targetEventId.slice(0, 8)}...
                    </code>
                  </>
                )}
              </div>

              {action.reason && (
                <div className="text-sm text-muted-foreground mb-2">
                  Reason: {action.reason}
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {new Date(action.createdAt * 1000).toLocaleString()}

                {action.duration && (
                  <>
                    <span>•</span>
                    <span>Duration: {formatDuration(action.duration)}</span>
                    {isExpired && (
                      <Badge variant="outline" className="text-xs">
                        Expired
                      </Badge>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <Badge className={getActionColor(action.action)}>
            {action.action}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function LogSkeleton() {
  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ModerationLogs({ communityId }: ModerationLogsProps) {
  const [filterAction, setFilterAction] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  const { data: logs, isLoading } = useModerationLogs(communityId);

  const filteredLogs = logs?.filter(log =>
    filterAction === 'all' || log.action === filterAction
  ) || [];

  const sortedLogs = [...filteredLogs].sort((a, b) => {
    return sortBy === 'newest'
      ? b.createdAt - a.createdAt
      : a.createdAt - b.createdAt;
  });

  const actionStats = logs?.reduce((acc, log) => {
    acc[log.action] = (acc[log.action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Moderation Logs</CardTitle>
          </CardHeader>
        </Card>
        {Array.from({ length: 5 }).map((_, i) => (
          <LogSkeleton key={i} />
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
              <Clock className="h-5 w-5" />
              Moderation Logs
            </span>
            <Badge variant="secondary">
              {filteredLogs.length} actions
            </Badge>
          </CardTitle>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="ban">Bans ({actionStats.ban || 0})</SelectItem>
                  <SelectItem value="mute">Mutes ({actionStats.mute || 0})</SelectItem>
                  <SelectItem value="delete">Deletions ({actionStats.delete || 0})</SelectItem>
                  <SelectItem value="approve">Approvals ({actionStats.approve || 0})</SelectItem>
                  <SelectItem value="pin">Pins ({actionStats.pin || 0})</SelectItem>
                  <SelectItem value="warn">Warnings ({actionStats.warn || 0})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'newest' | 'oldest')}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Action Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(actionStats).map(([action, count]) => (
          <Card key={action}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-sm text-muted-foreground capitalize">{action}s</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Logs List */}
      {sortedLogs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No moderation actions</h3>
            <p className="text-muted-foreground">
              {filterAction === 'all'
                ? 'No moderation actions have been taken in this community.'
                : `No ${filterAction} actions found.`
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedLogs.map((action) => (
            <LogEntry key={action.id} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}