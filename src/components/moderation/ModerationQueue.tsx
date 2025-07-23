import { useState } from 'react';
import { CheckCircle, XCircle, Trash2, AlertTriangle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useReports, type Report } from '@/hooks/useReporting';
import { useModerationActions } from '@/hooks/useModerationActions';
import { useAuthor } from '@/hooks/useAuthor';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { genUserName } from '@/lib/genUserName';

import { Skeleton } from '@/components/ui/skeleton';

interface ModerationQueueProps {
  communityId: string;
}

interface QueueItemProps {
  report: Report;
  communityId: string;
}

function QueueItem({ report, communityId }: QueueItemProps) {
  const [reason, setReason] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const author = useAuthor(report.targetPubkey);
  const reporter = useAuthor(report.reporterPubkey);

  const {
    approvePost,
    deletePost,
    banUser,
    muteUser,
    isApprovingPost,
    isDeletingPost,
    isBanningUser,
    isMutingUser,
  } = useModerationActions();

  const handleApprove = () => {
    if (report.targetEventId) {
      // For post reports, we need the actual post event
      // This is simplified - in practice you'd fetch the post event
      const mockPost = {
        id: report.targetEventId,
        pubkey: report.targetPubkey,
        kind: 1111,
        content: 'Post content would be here',
        tags: [],
        created_at: Date.now() / 1000,
        sig: '',
      };
      approvePost.mutate({ communityId, post: mockPost });
    }
  };

  const handleDelete = () => {
    if (report.targetEventId) {
      deletePost.mutate({
        communityId,
        postId: report.targetEventId,
        reason: reason || 'Violated community guidelines',
      });
    }
  };

  const handleBan = () => {
    banUser.mutate({
      communityId,
      userPubkey: report.targetPubkey,
      reason: reason || 'Violated community guidelines',
    });
  };

  const handleMute = () => {
    muteUser.mutate({
      communityId,
      userPubkey: report.targetPubkey,
      reason: reason || 'Violated community guidelines',
      duration: 7 * 24 * 60 * 60, // 7 days
    });
  };

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case 'spam': return 'bg-yellow-100 text-yellow-800';
      case 'nudity': return 'bg-red-100 text-red-800';
      case 'illegal': return 'bg-red-100 text-red-800';
      case 'profanity': return 'bg-orange-100 text-orange-800';
      case 'impersonation': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
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
              {report.reportType}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(report.createdAt * 1000).toLocaleDateString()}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {report.reason && (
          <div className="bg-muted p-3 rounded-md">
            <div className="text-sm font-medium mb-1">Report Reason:</div>
            <div className="text-sm">{report.reason}</div>
          </div>
        )}

        {report.targetEventId && (
          <div className="border rounded-md p-3">
            <div className="text-sm font-medium mb-2">Reported Content:</div>
            <div className="text-sm text-muted-foreground">
              {/* This would show the actual post content */}
              Post ID: {report.targetEventId.slice(0, 16)}...
            </div>
          </div>
        )}

        {isExpanded && (
          <div className="space-y-3">
            <Textarea
              placeholder="Add a reason for your action (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Less Options' : 'More Options'}
          </Button>

          <div className="flex items-center gap-2">
            {report.targetEventId && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleApprove}
                  disabled={isApprovingPost}
                  className="flex items-center gap-1"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeletingPost}
                  className="flex items-center gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={handleMute}
              disabled={isMutingUser}
              className="flex items-center gap-1"
            >
              <XCircle className="h-4 w-4" />
              Mute
            </Button>

            <Button
              size="sm"
              variant="destructive"
              onClick={handleBan}
              disabled={isBanningUser}
              className="flex items-center gap-1"
            >
              <AlertTriangle className="h-4 w-4" />
              Ban
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QueueSkeleton() {
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
        <Skeleton className="h-16 w-full" />
      </CardContent>
    </Card>
  );
}

export function ModerationQueue({ communityId }: ModerationQueueProps) {
  const { data: reports, isLoading } = useReports(communityId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Moderation Queue</CardTitle>
          </CardHeader>
        </Card>
        {Array.from({ length: 3 }).map((_, i) => (
          <QueueSkeleton key={i} />
        ))}
      </div>
    );
  }

  const pendingReports = reports || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Moderation Queue
            <Badge variant={pendingReports.length > 0 ? 'destructive' : 'secondary'}>
              {pendingReports.length} pending
            </Badge>
          </CardTitle>
        </CardHeader>
      </Card>

      {pendingReports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">All caught up!</h3>
            <p className="text-muted-foreground">
              No pending reports or content requiring moderation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingReports.map((report) => (
            <QueueItem
              key={report.id}
              report={report}
              communityId={communityId}
            />
          ))}
        </div>
      )}
    </div>
  );
}