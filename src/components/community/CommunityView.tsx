import { Link } from 'react-router-dom';
import { Users, Crown, Shield, Settings, UserPlus, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useCommunities } from '@/hooks/useCommunities';
import { useUserCommunityMembership } from '@/hooks/useUserCommunityMembership';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { useCommunityMembers } from '@/hooks/useCommunityMembers';
import { LoginArea } from '@/components/auth/LoginArea';
import { CommunityShareDialog } from './CommunityShareDialog';
import { genUserName } from '@/lib/genUserName';
import { Skeleton } from '@/components/ui/skeleton';

interface CommunityViewProps {
  communityId: string;
  naddr: string;
}

export function CommunityView({ communityId, naddr }: CommunityViewProps) {
  const { user } = useCurrentUser();
  const { data: communities, isLoading: isLoadingCommunities } = useCommunities();
  const { data: membershipStatus } = useUserCommunityMembership(communityId);
  const { data: members } = useCommunityMembers(communityId);

  const community = communities?.find(c => c.id === communityId);
  const creatorAuthor = useAuthor(community?.creator || '');

  if (isLoadingCommunities) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-8 w-64" />
                  <Skeleton className="h-4 w-96" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-16 w-16 mx-auto text-muted-foreground opacity-50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Community Not Found</h3>
              <p className="text-muted-foreground mb-4">
                This community doesn't exist or hasn't been loaded yet.
              </p>
              <Button asChild>
                <Link to="/communities">Browse Communities</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isOwner = membershipStatus === 'owner';
  const isModerator = membershipStatus === 'moderator';
  const isMember = membershipStatus === 'approved';
  const canModerate = isOwner || isModerator;
  const canView = canModerate || isMember;

  const getMembershipBadge = () => {
    switch (membershipStatus) {
      case 'owner':
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <Crown className="h-3 w-3" />
            Owner
          </Badge>
        );
      case 'moderator':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Moderator
          </Badge>
        );
      case 'approved':
        return <Badge variant="outline">Member</Badge>;
      case 'pending':
        return <Badge variant="outline">Request Pending</Badge>;
      case 'declined':
        return <Badge variant="destructive">Request Declined</Badge>;
      case 'banned':
        return <Badge variant="destructive">Banned</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Community Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={community.image} />
                  <AvatarFallback className="text-lg">
                    {community.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold">{community.name}</h1>
                    {getMembershipBadge()}
                  </div>
                  <p className="text-muted-foreground mb-3">
                    {community.description || 'A community on Nostr'}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{(members?.length || 0)} members</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Crown className="h-4 w-4" />
                      <span>
                        Created by {creatorAuthor.data?.metadata?.name || genUserName(community.creator)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CommunityShareDialog community={community}>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </CommunityShareDialog>
                {canModerate && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/communities/${encodeURIComponent(community.id)}/manage`}>
                      <Settings className="h-4 w-4 mr-2" />
                      Manage
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Access Control */}
        {!user && (
          <Card>
            <CardHeader>
              <CardTitle>Login Required</CardTitle>
              <CardDescription>
                You need to be logged in to view community content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoginArea className="w-full" />
            </CardContent>
          </Card>
        )}

        {user && !canView && (
          <Card>
            <CardContent className="py-12 text-center">
              <UserPlus className="h-16 w-16 mx-auto text-muted-foreground opacity-50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Join Required</h3>
              <p className="text-muted-foreground mb-4">
                You need to be a member to view this community's content.
              </p>
              <Button asChild>
                <Link to={`/join/${naddr}`}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Request to Join
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Community Content (for members) */}
        {canView && (
          <>
            {/* Community Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Members</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{members?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">Community members</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Moderators</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{community.moderators.length}</div>
                  <p className="text-xs text-muted-foreground">Active moderators</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Relays</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{community.relays.length || 1}</div>
                  <p className="text-xs text-muted-foreground">Connected relays</p>
                </CardContent>
              </Card>
            </div>

            {/* Community Features */}
            <Card>
              <CardHeader>
                <CardTitle>Community Features</CardTitle>
                <CardDescription>
                  Available features and channels in this community
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Community features coming soon!</p>
                  <p className="text-sm">Channels, messaging, and more will be available here.</p>
                </div>
              </CardContent>
            </Card>

            {/* Member List */}
            {members && members.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Members</CardTitle>
                  <CardDescription>
                    Community members and their roles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {members.slice(0, 10).map((member) => (
                      <MemberItem key={member.pubkey} member={member} />
                    ))}
                    {members.length > 10 && (
                      <div className="text-center pt-4">
                        <Button variant="outline">
                          View All {members.length} Members
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Community Information */}
        <Card>
          <CardHeader>
            <CardTitle>Community Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-1">Community ID</h4>
                <p className="text-muted-foreground font-mono text-xs break-all">
                  {community.id}
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Creator</h4>
                <p className="text-muted-foreground">
                  {creatorAuthor.data?.metadata?.name || genUserName(community.creator)}
                </p>
              </div>
            </div>

            {community.relays.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">Relays</h4>
                  <div className="space-y-1">
                    {community.relays.map((relay, index) => (
                      <p key={index} className="text-sm text-muted-foreground font-mono">
                        {relay}
                      </p>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
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
    <div className="flex items-center gap-3 p-3 border rounded-lg">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${getRoleColor()}`}>
        {avatar ? (
          <img src={avatar} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          displayName.charAt(0).toUpperCase()
        )}
      </div>
      <div className="flex-1">
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
  );
}