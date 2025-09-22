import { useState } from 'react';
import { Shield, Crown, BarChart3, Settings, Users, Flag, AlertTriangle, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDataManagerCanModerate, useDataManagerCommunityMembers } from '@/components/DataManagerProvider';
import { useModerationStats } from '@/hooks/useModerationLogs';
import { useReports } from '@/hooks/useReporting';
import { ModerationQueue } from './ModerationQueue';
import { UserManagement } from './UserManagement';
import { ReportsPanel } from './ReportsPanel';
import { ModerationLogs } from './ModerationLogs';
import { ModerationAnalytics } from './ModerationAnalytics';
import { CommunitySettings } from './CommunitySettings';
import { AdminPanel } from './AdminPanel';
import { Skeleton } from '@/components/ui/skeleton';

interface ModerationDashboardProps {
  communityId: string;
}

interface QuickStatsProps {
  communityId: string;
}

function QuickStats({ communityId }: QuickStatsProps) {
  const moderationStats = useModerationStats(communityId);
  const { data: reports, isLoading: isLoadingReports } = useReports(communityId);
  const { data: members, isLoading: isLoadingMembers } = useDataManagerCommunityMembers(communityId);

  const isLoading = isLoadingReports || isLoadingMembers;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const pendingReports = reports?.length || 0;
  const totalMembers = members?.length || 0;
  const totalActions = moderationStats?.totalActions || 0;
  const recentActions = moderationStats?.recentActions.length || 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pending Reports</p>
              <p className="text-3xl font-bold">{pendingReports}</p>
            </div>
            <Flag className={`h-8 w-8 ${pendingReports > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Members</p>
              <p className="text-3xl font-bold">{totalMembers}</p>
            </div>
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Actions</p>
              <p className="text-3xl font-bold">{totalActions}</p>
            </div>
            <Shield className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Recent Activity</p>
              <p className="text-3xl font-bold">{recentActions}</p>
            </div>
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ModerationDashboard({ communityId }: ModerationDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const { canModerate, role } = useDataManagerCanModerate(communityId);
  const { data: reports } = useReports(communityId);

  if (!canModerate) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to access moderation tools for this community.
          </p>
        </CardContent>
      </Card>
    );
  }

  const pendingReports = reports?.length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Moderation Dashboard
                <Badge variant={role === 'owner' ? 'default' : 'secondary'}>
                  {role}
                </Badge>
              </CardTitle>
              <p className="text-muted-foreground mt-1">
                Manage community content, users, and settings
              </p>
            </div>
            {role === 'owner' && (
              <Button
                variant="outline"
                onClick={() => setActiveTab('admin')}
                className="flex items-center gap-2"
              >
                <Crown className="h-4 w-4" />
                Admin Panel
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Quick Stats */}
      <QuickStats communityId={communityId} />

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="queue" className="flex items-center gap-1">
            Queue
            {pendingReports > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 text-xs">
                {pendingReports}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          {role === 'owner' && (
            <TabsTrigger value="admin" className="flex items-center gap-1">
              <Crown className="h-3 w-3" />
              Admin
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingReports > 0 ? (
                    <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Flag className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium">Pending Reports</span>
                      </div>
                      <Badge variant="destructive">{pendingReports}</Badge>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">All Clear</span>
                      </div>
                      <Badge variant="outline">No pending reports</Badge>
                    </div>
                  )}

                  <div className="text-center py-4">
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab('queue')}
                      className="flex items-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      View Moderation Queue
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab('users')}
                    className="flex items-center gap-2 h-auto p-4"
                  >
                    <Users className="h-4 w-4" />
                    <div className="text-left">
                      <div className="font-medium">Manage Users</div>
                      <div className="text-xs text-muted-foreground">Members & Moderators</div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setActiveTab('analytics')}
                    className="flex items-center gap-2 h-auto p-4"
                  >
                    <BarChart3 className="h-4 w-4" />
                    <div className="text-left">
                      <div className="font-medium">View Analytics</div>
                      <div className="text-xs text-muted-foreground">Trends & Insights</div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setActiveTab('settings')}
                    className="flex items-center gap-2 h-auto p-4"
                  >
                    <Settings className="h-4 w-4" />
                    <div className="text-left">
                      <div className="font-medium">Settings</div>
                      <div className="text-xs text-muted-foreground">Community Config</div>
                    </div>
                  </Button>

                  {role === 'owner' && (
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab('admin')}
                      className="flex items-center gap-2 h-auto p-4"
                    >
                      <Crown className="h-4 w-4" />
                      <div className="text-left">
                        <div className="font-medium">Admin Panel</div>
                        <div className="text-xs text-muted-foreground">Owner Tools</div>
                      </div>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="queue">
          <ModerationQueue communityId={communityId} />
        </TabsContent>

        <TabsContent value="users">
          <UserManagement communityId={communityId} />
        </TabsContent>

        <TabsContent value="reports">
          <ReportsPanel communityId={communityId} />
        </TabsContent>

        <TabsContent value="logs">
          <ModerationLogs communityId={communityId} />
        </TabsContent>

        <TabsContent value="analytics">
          <ModerationAnalytics communityId={communityId} />
        </TabsContent>

        <TabsContent value="settings">
          <CommunitySettings communityId={communityId} />
        </TabsContent>

        {role === 'owner' && (
          <TabsContent value="admin">
            <AdminPanel communityId={communityId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}