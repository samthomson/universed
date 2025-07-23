import { useState } from "react";
import { Settings, Users, Shield, BarChart3, FileText, Trash2, Crown, Clock, AlertTriangle, Share2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useCommunities } from "@/hooks/useCommunities";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCommunityMembers } from "@/hooks/useCommunityMembers";
import { useJoinRequests } from "@/hooks/useJoinRequests";
import { useModerationLogs, useModerationStats } from "@/hooks/useModerationLogs";
import { useReports } from "@/hooks/useReporting";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";
import { CommunityShareDialog } from "./CommunityShareDialog";

interface CommunitySettingsProps {
  communityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommunitySettings({ communityId, open, onOpenChange }: CommunitySettingsProps) {
  const { data: communities } = useCommunities();
  const { user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState("overview");

  // Real data hooks
  const { data: members } = useCommunityMembers(communityId);
  const { data: joinRequests } = useJoinRequests(communityId);
  const { data: moderationLogs } = useModerationLogs(communityId || '');
  const moderationStats = useModerationStats(communityId || '');
  const { data: reports } = useReports(communityId);

  const community = communities?.find(c => c.id === communityId);

  if (!community) {
    return null;
  }

  // Check if user is admin/mod
  const isAdmin = user?.pubkey === community.creator;
  const isModerator = community.moderators.includes(user?.pubkey || '');

  if (!isAdmin && !isModerator) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Access Denied</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            You don't have permission to access community settings.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  // Calculate analytics from real data
  const totalMembers = members?.length || 0;
  const onlineMembers = members?.filter(m => m.isOnline).length || 0;
  const pendingRequests = joinRequests?.length || 0;
  const totalReports = reports?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {community.name} Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview" className="flex items-center gap-1">
              <Settings className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="sharing" className="flex items-center gap-1">
              <Share2 className="w-4 h-4" />
              Sharing
            </TabsTrigger>
            <TabsTrigger value="moderation" className="flex items-center gap-1">
              <Shield className="w-4 h-4" />
              Moderation
            </TabsTrigger>
            <TabsTrigger value="members" className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              Members
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              Audit Log
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[60vh] mt-4">
            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Community Information</CardTitle>
                  <CardDescription>
                    Basic settings for your community
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="community-name">Community Name</Label>
                    <Input id="community-name" defaultValue={community.name} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="community-description">Description</Label>
                    <Textarea
                      id="community-description"
                      placeholder="Describe your community..."
                      defaultValue={community.description || ""}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="public-community" />
                    <Label htmlFor="public-community">Public Community</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="require-approval" />
                    <Label htmlFor="require-approval">Require approval to join</Label>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-red-600">Danger Zone</CardTitle>
                  <CardDescription>
                    Irreversible actions for this community
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="flex items-center gap-2">
                        <Trash2 className="w-4 h-4" />
                        Delete Community
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the community
                          and remove all associated data.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700">
                          Delete Community
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sharing" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Share Your Community</CardTitle>
                  <CardDescription>
                    Generate shareable links to invite new members to your community
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-8">
                    <Share2 className="h-16 w-16 mx-auto text-muted-foreground opacity-50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Invite New Members</h3>
                    <p className="text-muted-foreground mb-4">
                      Share your community with others using shareable links
                    </p>
                    <CommunityShareDialog community={community}>
                      <Button size="lg">
                        <Share2 className="h-4 w-4 mr-2" />
                        Generate Share Links
                      </Button>
                    </CommunityShareDialog>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="moderation" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Auto-Moderation</CardTitle>
                  <CardDescription>
                    Automatically moderate content based on rules
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch id="auto-delete-spam" />
                    <Label htmlFor="auto-delete-spam">Auto-delete spam messages</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="filter-profanity" />
                    <Label htmlFor="filter-profanity">Filter profanity</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="require-verification" />
                    <Label htmlFor="require-verification">Require phone verification</Label>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Moderation Queue</CardTitle>
                  <CardDescription>
                    Review flagged content and user reports ({totalReports} pending)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {reports && reports.length > 0 ? (
                      reports.slice(0, 5).map((report) => (
                        <ReportItem key={report.id} report={report} />
                      ))
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No pending reports</p>
                      </div>
                    )}
                    {reports && reports.length > 5 && (
                      <Button variant="outline" className="w-full">
                        View All {reports.length} Reports
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="members" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Member Management</CardTitle>
                  <CardDescription>
                    Manage community members and their roles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {members && members.length > 0 ? (
                      members.slice(0, 10).map((member) => (
                        <MemberItem key={member.pubkey} member={member} />
                      ))
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No members found</p>
                      </div>
                    )}
                    {members && members.length > 10 && (
                      <Button variant="outline" className="w-full">
                        View All {members.length} Members
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Join Requests</CardTitle>
                  <CardDescription>
                    Pending requests to join the community
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {joinRequests && joinRequests.length > 0 ? (
                      joinRequests.map((request) => (
                        <JoinRequestItem key={request.event.id} request={request} />
                      ))
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No pending join requests</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Members</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalMembers}</div>
                    <p className="text-xs text-muted-foreground">Community members</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Join Requests</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{pendingRequests}</div>
                    <p className="text-xs text-muted-foreground">Pending approval</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Online Members</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{onlineMembers}</div>
                    <p className="text-xs text-muted-foreground">Currently active</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Mod Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{moderationStats.totalActions}</div>
                    <p className="text-xs text-muted-foreground">Total actions taken</p>
                  </CardContent>
                </Card>
              </div>

              {moderationStats.totalActions > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Moderation Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(moderationStats.actionsByType).map(([action, count]) => (
                        <div key={action} className="flex justify-between">
                          <span className="capitalize text-sm">{action}:</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="audit" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Audit Log</CardTitle>
                  <CardDescription>
                    Recent moderation and administrative actions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {moderationLogs && moderationLogs.length > 0 ? (
                      moderationLogs.slice(0, 10).map((log) => (
                        <ModerationLogItem key={log.id} log={log} />
                      ))
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No moderation actions recorded</p>
                      </div>
                    )}
                    {moderationLogs && moderationLogs.length > 10 && (
                      <Button variant="outline" className="w-full">
                        View All {moderationLogs.length} Actions
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>

          <Separator className="my-4" />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button>
              Save Changes
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Helper component for displaying member items
function MemberItem({ member }: { member: { pubkey: string; role: 'owner' | 'moderator' | 'member'; isOnline: boolean } }) {
  const author = useAuthor(member.pubkey);
  const displayName = author.data?.metadata?.name || genUserName(member.pubkey);
  const avatar = author.data?.metadata?.picture;

  const getRoleIcon = () => {
    switch (member.role) {
      case 'owner':
        return <Crown className="w-3 h-3" />;
      case 'moderator':
        return <Shield className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getRoleColor = () => {
    switch (member.role) {
      case 'owner':
        return 'bg-yellow-500';
      case 'moderator':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${getRoleColor()}`}>
          {avatar ? (
            <img src={avatar} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            displayName.charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{displayName}</p>
            {member.isOnline && (
              <div className="w-2 h-2 bg-green-500 rounded-full" title="Online" />
            )}
          </div>
          <div className="flex gap-1">
            <Badge variant={member.role === 'owner' ? 'secondary' : 'outline'} className="flex items-center gap-1">
              {getRoleIcon()}
              {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
            </Badge>
          </div>
        </div>
      </div>
      <Button size="sm" variant="outline">Manage</Button>
    </div>
  );
}

// Helper component for displaying join requests
function JoinRequestItem({ request }: { request: { requesterPubkey: string; message: string; createdAt: number } }) {
  const author = useAuthor(request.requesterPubkey);
  const displayName = author.data?.metadata?.name || genUserName(request.requesterPubkey);
  const avatar = author.data?.metadata?.picture;

  const timeAgo = new Date(request.createdAt * 1000).toLocaleString();

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
          {avatar ? (
            <img src={avatar} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            displayName.charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <p className="font-medium">{displayName}</p>
          <p className="text-sm text-muted-foreground">Requested {timeAgo}</p>
          {request.message && (
            <p className="text-xs text-muted-foreground mt-1 italic">"{request.message}"</p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline">Accept</Button>
        <Button size="sm" variant="destructive">Decline</Button>
      </div>
    </div>
  );
}

// Helper component for displaying reports
function ReportItem({ report }: { report: { targetPubkey: string; reportType: string; reason: string; createdAt: number; targetEventId?: string } }) {
  const author = useAuthor(report.targetPubkey);
  const displayName = author.data?.metadata?.name || genUserName(report.targetPubkey);

  const timeAgo = new Date(report.createdAt * 1000).toLocaleString();

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <p className="font-medium">
            {report.targetEventId ? 'Content reported' : 'User reported'}: {displayName}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Type: {report.reportType} • {timeAgo}
        </p>
        {report.reason && (
          <p className="text-xs text-muted-foreground mt-1 italic">"{report.reason}"</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline">Review</Button>
        <Button size="sm" variant="destructive">
          {report.targetEventId ? 'Delete' : 'Ban User'}
        </Button>
      </div>
    </div>
  );
}

// Helper component for displaying moderation log items
function ModerationLogItem({ log }: { log: { action: string; moderatorPubkey: string; targetPubkey?: string; reason: string; createdAt: number } }) {
  const moderator = useAuthor(log.moderatorPubkey);
  const target = useAuthor(log.targetPubkey || '');

  const moderatorName = moderator.data?.metadata?.name || genUserName(log.moderatorPubkey);
  const targetName = log.targetPubkey ? (target.data?.metadata?.name || genUserName(log.targetPubkey)) : null;

  const timeAgo = new Date(log.createdAt * 1000).toLocaleString();

  const getActionIcon = () => {
    switch (log.action) {
      case 'ban':
      case 'mute':
        return <Shield className="w-4 h-4 mt-1 text-red-500" />;
      case 'delete':
        return <Trash2 className="w-4 h-4 mt-1 text-red-500" />;
      case 'approve':
        return <Shield className="w-4 h-4 mt-1 text-green-500" />;
      default:
        return <FileText className="w-4 h-4 mt-1 text-blue-500" />;
    }
  };

  const getActionDescription = () => {
    const actionText = log.action.charAt(0).toUpperCase() + log.action.slice(1);
    if (targetName) {
      return `${moderatorName} ${log.action}ned ${targetName}`;
    }
    return `${moderatorName} performed ${actionText}`;
  };

  return (
    <div className="flex items-start gap-3 p-3 border rounded-lg">
      {getActionIcon()}
      <div className="flex-1">
        <p className="text-sm font-medium">{getActionDescription()}</p>
        {log.reason && (
          <p className="text-xs text-muted-foreground">Reason: {log.reason}</p>
        )}
        <p className="text-xs text-muted-foreground">{timeAgo}</p>
      </div>
    </div>
  );
}