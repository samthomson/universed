import { useState } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { Shield, Crown, Settings, BarChart3, Users, AlertTriangle, Share2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useDataManager, useDataManagerUserRole, useDataManagerCanModerate } from '@/components/DataManagerProvider';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { Community } from '@/hooks/useCommunities';
import { ModerationDashboard } from '@/components/moderation/ModerationDashboard';
import { AdminPanel } from '@/components/moderation/AdminPanel';
import { CommunitySettings } from '@/components/moderation/CommunitySettings';
import { UserManagement } from '@/components/moderation/UserManagement';
import { ModerationAnalytics } from '@/components/moderation/ModerationAnalytics';
import { LoginArea } from '@/components/auth/LoginArea';
import { Skeleton } from '@/components/ui/skeleton';
import { CommunityShareDialog } from '@/components/community/CommunityShareDialog';

// Convert DataManager community format to old Community format for compatibility
function convertToOldCommunityFormat(community: any): Community | null {
  if (!community) return null;

  return {
    id: community.fullAddressableId, // Use full addressable format (34550:pubkey:identifier)
    name: community.info.name,
    description: community.info.description,
    image: community.info.image,
    banner: community.info.banner,
    creator: community.definitionEvent.pubkey,
    moderators: community.info.moderators,
    relays: community.info.relays,
    event: community.definitionEvent,
  };
}

export function CommunityManagement() {
  const { communityId } = useParams<{ communityId: string }>();
  const [activeTab, setActiveTab] = useState('dashboard');
  const navigate = useNavigate();

  const { user } = useCurrentUser();
  const { communities } = useDataManager();
  const { role } = useDataManagerUserRole(communityId || '', user?.pubkey);
  const { canModerate } = useDataManagerCanModerate(communityId || '');

  // Get community from DataManager
  const community = communityId ? communities.communities.get(communityId) : null;

  // Convert to old format for compatibility with existing components
  const oldFormatCommunity = convertToOldCommunityFormat(community);

  if (!communityId) {
    return <Navigate to="/communities" replace />;
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Login Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              You need to be logged in to access community management features.
            </p>
            <LoginArea className="w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading state while community data is being fetched
  if (!community) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!canModerate) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Access Denied</h3>
            <p className="text-muted-foreground mb-4">
              You don't have permission to manage this community. Only moderators and owners can access these features.
            </p>
            <Button onClick={() => window.history.back()}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Community Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={community.info.image} />
                  <AvatarFallback className="text-lg">
                    {community.info.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold">{community.info.name}</h1>
                    <Badge variant={role === 'owner' ? 'default' : 'secondary'}>
                      {role === 'owner' && <Crown className="h-3 w-3 mr-1" />}
                      {role === 'moderator' && <Shield className="h-3 w-3 mr-1" />}
                      {role}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {community.info.description || 'Community management dashboard'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {oldFormatCommunity && (
                  <CommunityShareDialog community={oldFormatCommunity}>
                    <Button variant="outline">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                  </CommunityShareDialog>
                )}
                <Button variant="outline" onClick={() => navigate(`/space/${encodeURIComponent(communityId)}`)}>
                  Back to Community
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Management Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            {role === 'owner' && (
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <Crown className="h-4 w-4" />
                Admin
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="dashboard">
            <ModerationDashboard communityId={communityId} />
          </TabsContent>

          <TabsContent value="users">
            <UserManagement communityId={communityId} />
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
    </div>
  );
}