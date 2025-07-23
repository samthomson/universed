import { useState } from 'react';
import { Clock, CheckCircle, AlertTriangle, User, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { genUserName } from '@/lib/genUserName';

interface ModerationWorkflowProps {
  communityId: string;
  items: ModerationItem[];
}

interface ModerationItem {
  id: string;
  type: 'report' | 'flagged_content' | 'user_appeal';
  status: 'pending' | 'in_review' | 'escalated' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  targetPubkey?: string;
  targetEventId?: string;
  reporterPubkey?: string;
  reason: string;
  description: string;
  createdAt: number;
  assignedTo?: string;
  reviewHistory: ReviewAction[];
}

interface ReviewAction {
  id: string;
  moderatorPubkey: string;
  action: 'assigned' | 'reviewed' | 'escalated' | 'resolved' | 'dismissed' | 'appealed';
  reason: string;
  timestamp: number;
}

interface WorkflowItemProps {
  item: ModerationItem;
  _communityId: string;
  onStatusChange: (itemId: string, newStatus: ModerationItem['status'], reason: string) => void;
}

function WorkflowItem({ item, _communityId, onStatusChange }: WorkflowItemProps) {
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'resolve' | 'escalate' | 'dismiss'>('resolve');
  const [reviewReason, setReviewReason] = useState('');

  const author = useAuthor(item.targetPubkey || '');
  const reporter = useAuthor(item.reporterPubkey || '');
  const assignedModerator = useAuthor(item.assignedTo || '');

  const { user } = useCurrentUser();
  const { toast } = useToast();

  const getStatusColor = (status: ModerationItem['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'in_review': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'escalated': return 'bg-red-100 text-red-800 border-red-200';
      case 'resolved': return 'bg-green-100 text-green-800 border-green-200';
      case 'dismissed': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: ModerationItem['priority']) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: ModerationItem['type']) => {
    switch (type) {
      case 'report': return <AlertTriangle className="h-4 w-4" />;
      case 'flagged_content': return <FileText className="h-4 w-4" />;
      case 'user_appeal': return <User className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const handleReview = () => {
    if (!reviewReason.trim()) {
      toast({
        title: 'Review reason required',
        description: 'Please provide a reason for your review decision.',
        variant: 'destructive',
      });
      return;
    }

    let newStatus: ModerationItem['status'];
    switch (reviewAction) {
      case 'resolve':
        newStatus = 'resolved';
        break;
      case 'escalate':
        newStatus = 'escalated';
        break;
      case 'dismiss':
        newStatus = 'dismissed';
        break;
      default:
        newStatus = 'in_review';
    }

    onStatusChange(item.id, newStatus, reviewReason);
    setIsReviewDialogOpen(false);
    setReviewReason('');
  };

  const canTakeAction = user && (item.status === 'pending' || item.status === 'in_review' || !item.assignedTo || item.assignedTo === user.pubkey);

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {getTypeIcon(item.type)}
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-medium capitalize">{item.type.replace('_', ' ')}</h4>
                <Badge className={getPriorityColor(item.priority)}>
                  {item.priority}
                </Badge>
                <Badge className={getStatusColor(item.status)}>
                  {item.status.replace('_', ' ')}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {item.reason}
              </p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(item.createdAt * 1000).toLocaleDateString()}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="bg-muted p-3 rounded-md">
          <p className="text-sm">{item.description}</p>
        </div>

        {/* Involved Users */}
        <div className="flex items-center gap-4 text-sm">
          {item.targetPubkey && (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={author.data?.metadata?.picture} />
                <AvatarFallback className="text-xs">
                  {genUserName(item.targetPubkey).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-muted-foreground">Target:</span>
              <span>{author.data?.metadata?.name || genUserName(item.targetPubkey)}</span>
            </div>
          )}

          {item.reporterPubkey && (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={reporter.data?.metadata?.picture} />
                <AvatarFallback className="text-xs">
                  {genUserName(item.reporterPubkey).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-muted-foreground">Reporter:</span>
              <span>{reporter.data?.metadata?.name || genUserName(item.reporterPubkey)}</span>
            </div>
          )}
        </div>

        {/* Assignment */}
        {item.assignedTo && (
          <div className="flex items-center gap-2 text-sm">
            <Avatar className="h-6 w-6">
              <AvatarImage src={assignedModerator.data?.metadata?.picture} />
              <AvatarFallback className="text-xs">
                {genUserName(item.assignedTo).slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground">Assigned to:</span>
            <span>{assignedModerator.data?.metadata?.name || genUserName(item.assignedTo)}</span>
          </div>
        )}

        {/* Review History */}
        {item.reviewHistory.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-sm font-medium">Review History</h5>
            <div className="space-y-1">
              {item.reviewHistory.slice(-3).map((review) => (
                <div key={review.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(review.timestamp * 1000).toLocaleDateString()}</span>
                  <span>•</span>
                  <span className="capitalize">{review.action}</span>
                  {review.reason && (
                    <>
                      <span>•</span>
                      <span>{review.reason}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-2">
            {item.status === 'pending' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onStatusChange(item.id, 'in_review', 'Started review')}
                disabled={!canTakeAction}
              >
                Start Review
              </Button>
            )}

            {canTakeAction && item.status !== 'resolved' && item.status !== 'dismissed' && (
              <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    Take Action
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Review Moderation Item</DialogTitle>
                    <DialogDescription>
                      Choose an action and provide a reason for your decision.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Action</Label>
                      <Select value={reviewAction} onValueChange={(value) => setReviewAction(value as 'resolve' | 'escalate' | 'dismiss')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="resolve">Resolve - Take corrective action</SelectItem>
                          <SelectItem value="escalate">Escalate - Needs senior review</SelectItem>
                          <SelectItem value="dismiss">Dismiss - No action needed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Reason</Label>
                      <Textarea
                        value={reviewReason}
                        onChange={(e) => setReviewReason(e.target.value)}
                        placeholder="Explain your decision..."
                        className="min-h-[80px]"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleReview}>
                      Submit Review
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {Math.floor((Date.now() / 1000 - item.createdAt) / 3600)}h ago
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ModerationWorkflow({ communityId, items }: ModerationWorkflowProps) {
  const [filterStatus, setFilterStatus] = useState<ModerationItem['status'] | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<ModerationItem['priority'] | 'all'>('all');

  const { toast } = useToast();

  const filteredItems = items.filter(item => {
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    if (filterPriority !== 'all' && item.priority !== filterPriority) return false;
    return true;
  });

  const sortedItems = filteredItems.sort((a, b) => {
    // Sort by priority first, then by creation time
    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.createdAt - a.createdAt;
  });

  const handleStatusChange = (itemId: string, newStatus: ModerationItem['status'], _reason: string) => {
    // TODO: Implement API call to update item status
    toast({
      title: 'Status updated',
      description: `Item has been marked as ${newStatus.replace('_', ' ')}.`,
    });
  };

  const statusCounts = items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Moderation Workflow</CardTitle>
          <div className="flex items-center gap-4">
            <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as ModerationItem['status'] | 'all')}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending ({statusCounts.pending || 0})</SelectItem>
                <SelectItem value="in_review">In Review ({statusCounts.in_review || 0})</SelectItem>
                <SelectItem value="escalated">Escalated ({statusCounts.escalated || 0})</SelectItem>
                <SelectItem value="resolved">Resolved ({statusCounts.resolved || 0})</SelectItem>
                <SelectItem value="dismissed">Dismissed ({statusCounts.dismissed || 0})</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterPriority} onValueChange={(value) => setFilterPriority(value as ModerationItem['priority'] | 'all')}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Workflow Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(statusCounts).map(([status, count]) => (
          <Card key={status}>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-sm text-muted-foreground capitalize">
                {status.replace('_', ' ')}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Workflow Items */}
      {sortedItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">All caught up!</h3>
            <p className="text-muted-foreground">
              {filterStatus === 'all' && filterPriority === 'all'
                ? 'No moderation items require attention.'
                : 'No items match the current filters.'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedItems.map((item) => (
            <WorkflowItem
              key={item.id}
              item={item}
              _communityId={communityId}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}