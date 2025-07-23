import { useState } from 'react';
import { Shield, Users, Flag, BarChart3, Settings, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useCanModerate } from '@/hooks/useCommunityRoles';
import { useModerationStats } from '@/hooks/useModerationLogs';
import { useReports } from '@/hooks/useReporting';
import { ModerationQueue } from './ModerationQueue';
import { UserManagement } from './UserManagement';
import { ReportsPanel } from './ReportsPanel';
import { ModerationLogs } from './ModerationLogs';
import { CommunitySettings } from './CommunitySettings';
import { ModerationAnalytics } from './ModerationAnalytics';

interface ModerationPanelProps {
  communityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModerationPanel({ communityId, open, onOpenChange }: ModerationPanelProps) {
  const [activeTab, setActiveTab] = useState('queue');
  const { canModerate, role } = useCanModerate(communityId);
  const moderationStats = useModerationStats(communityId);
  const { data: reports } = useReports(communityId);

  if (!open) return null;

  if (!canModerate) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You don't have permission to access moderation tools for this community.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => onOpenChange(false)}
              className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
            >
              Close
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingReports = reports?.length || 0;
  const _recentActions = moderationStats?.totalActions || 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-6xl h-[90vh] flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Moderation Panel
                <Badge variant={role === 'owner' ? 'default' : 'secondary'}>
                  {role}
                </Badge>
              </CardTitle>
              <CardDescription>
                Manage community content, users, and settings
              </CardDescription>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
        </CardHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-6 mx-4 mt-4">
              <TabsTrigger value="queue" className="flex items-center gap-2">
                <Flag className="h-4 w-4" />
                Queue
                {pendingReports > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs">
                    {pendingReports}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Users
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Reports
              </TabsTrigger>
              <TabsTrigger value="logs" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Logs
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto p-4">
              <TabsContent value="queue" className="mt-0 h-full">
                <ModerationQueue communityId={communityId} />
              </TabsContent>

              <TabsContent value="users" className="mt-0 h-full">
                <UserManagement communityId={communityId} />
              </TabsContent>

              <TabsContent value="reports" className="mt-0 h-full">
                <ReportsPanel communityId={communityId} />
              </TabsContent>

              <TabsContent value="logs" className="mt-0 h-full">
                <ModerationLogs communityId={communityId} />
              </TabsContent>

              <TabsContent value="analytics" className="mt-0 h-full">
                <ModerationAnalytics communityId={communityId} />
              </TabsContent>

              <TabsContent value="settings" className="mt-0 h-full">
                <CommunitySettings communityId={communityId} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </Card>
    </div>
  );
}