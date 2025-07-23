import { useState } from 'react';
import { Search, UserPlus, UserMinus, Shield, Ban, VolumeX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCommunityMembers } from '@/hooks/useCommunityMembers';
import { useCommunityRoles, useCommunityModerators, useCanModerate } from '@/hooks/useCommunityRoles';
import { useManageMembers } from '@/hooks/useManageMembers';
import { useModerationActions } from '@/hooks/useModerationActions';
import { useUserModerationStatus } from '@/hooks/useModerationLogs';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { Skeleton } from '@/components/ui/skeleton';

interface UserManagementProps {
  communityId: string;
}

interface UserCardProps {
  pubkey: string;
  communityId: string;
  role?: 'owner' | 'moderator' | 'member';
  onRoleChange?: () => void;
}

function UserCard({ pubkey, communityId, role = 'member', onRoleChange }: UserCardProps) {
  const author = useAuthor(pubkey);
  const { canAssignModerators } = useCanModerate(communityId);
  const { assignModerator, removeModerator } = useCommunityRoles(communityId);
  const { removeMember } = useManageMembers();
  const { banUser, muteUser } = useModerationActions();
  const { isBanned, isMuted } = useUserModerationStatus(communityId, pubkey);

  const handlePromoteToModerator = () => {
    assignModerator({ userPubkey: pubkey });
    onRoleChange?.();
  };

  const handleRemoveModerator = () => {
    removeModerator({ userPubkey: pubkey });
    onRoleChange?.();
  };

  const handleRemoveFromCommunity = () => {
    removeMember({ communityId, memberPubkey: pubkey });
  };

  const handleBanUser = () => {
    banUser({
      communityId,
      userPubkey: pubkey,
      reason: 'Banned by moderator',
    });
  };

  const handleMuteUser = () => {
    muteUser({
      communityId,
      userPubkey: pubkey,
      reason: 'Muted by moderator',
      duration: 7 * 24 * 60 * 60, // 7 days
    });
  };

  const displayName = author.data?.metadata?.name || genUserName(pubkey);
  const avatar = author.data?.metadata?.picture;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={avatar} />
            <AvatarFallback>
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{displayName}</div>
            <div className="text-sm text-muted-foreground">
              {pubkey.slice(0, 16)}...
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status badges */}
          <Badge variant={role === 'owner' ? 'default' : role === 'moderator' ? 'secondary' : 'outline'}>
            {role}
          </Badge>
          {isBanned && <Badge variant="destructive">Banned</Badge>}
          {isMuted && <Badge variant="outline">Muted</Badge>}

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {canAssignModerators && role === 'member' && (
              <Button
                size="sm"
                variant="outline"
                onClick={handlePromoteToModerator}
                className="flex items-center gap-1"
              >
                <Shield className="h-3 w-3" />
                Promote
              </Button>
            )}

            {canAssignModerators && role === 'moderator' && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRemoveModerator}
                className="flex items-center gap-1"
              >
                <UserMinus className="h-3 w-3" />
                Demote
              </Button>
            )}

            {!isMuted && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleMuteUser}
                className="flex items-center gap-1"
              >
                <VolumeX className="h-3 w-3" />
                Mute
              </Button>
            )}

            {!isBanned && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBanUser}
                className="flex items-center gap-1"
              >
                <Ban className="h-3 w-3" />
                Ban
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={handleRemoveFromCommunity}
              className="flex items-center gap-1"
            >
              <UserMinus className="h-3 w-3" />
              Remove
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function UserSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </Card>
  );
}

export function UserManagement({ communityId }: UserManagementProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('members');

  const { data: members, isLoading } = useCommunityMembers(communityId);
  const { moderators, owner } = useCommunityModerators(communityId);

  const filteredMembers = members?.filter(member =>
    member.pubkey.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredModerators = moderators.filter(mod =>
    mod.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
          </CardHeader>
        </Card>
        {Array.from({ length: 5 }).map((_, i) => (
          <UserSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Invite Users
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="members">
            Members ({filteredMembers.length})
          </TabsTrigger>
          <TabsTrigger value="moderators">
            Moderators ({filteredModerators.length})
          </TabsTrigger>
          <TabsTrigger value="banned">
            Banned Users
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-3">
          {filteredMembers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  {searchQuery ? 'No members found matching your search.' : 'No members found.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredMembers.map((member) => (
              <UserCard
                key={member.pubkey}
                pubkey={member.pubkey}
                communityId={communityId}
                role={member.role}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="moderators" className="space-y-3">
          {owner && (
            <UserCard
              key={owner}
              pubkey={owner}
              communityId={communityId}
              role="owner"
            />
          )}
          {filteredModerators.map((pubkey) => (
            <UserCard
              key={pubkey}
              pubkey={pubkey}
              communityId={communityId}
              role="moderator"
            />
          ))}
          {filteredModerators.length === 0 && !owner && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No moderators found.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="banned" className="space-y-3">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Banned users list would be implemented here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}