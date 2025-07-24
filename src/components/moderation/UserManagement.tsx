import { useState } from 'react';
import { Clock, Users } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { MemberManagementPanel } from '@/components/community/MemberManagementPanel';
import { JoinRequestsPanel } from '@/components/community/JoinRequestsPanel';
import { useJoinRequests } from '@/hooks/useJoinRequests';
import { useCommunityMemberLists } from '@/hooks/useCommunityMemberLists';

interface UserManagementProps {
  communityId: string;
}

export function UserManagement({ communityId }: UserManagementProps) {
  const [activeTab, setActiveTab] = useState('requests');

  const { data: joinRequests } = useJoinRequests(communityId);
  const { data: members } = useCommunityMemberLists(communityId);

  const pendingRequestsCount = joinRequests?.length || 0;
  const approvedMembersCount = members?.approved?.length || 0;
  const declinedMembersCount = members?.declined?.length || 0;
  const bannedMembersCount = members?.banned?.length || 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage join requests, approved members, and community access
          </p>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Join Requests
            {pendingRequestsCount > 0 && (
              <Badge variant="destructive" className="ml-1">
                {pendingRequestsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Member Lists
            <Badge variant="outline" className="ml-1">
              {approvedMembersCount + declinedMembersCount + bannedMembersCount}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <Card className="h-[600px] flex flex-col">
            <JoinRequestsPanel communityId={communityId} />
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <Card className="h-[600px] flex flex-col">
            <MemberManagementPanel communityId={communityId} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}