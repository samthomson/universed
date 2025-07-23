import { useState } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { Users, Shield, Crown, ExternalLink, UserPlus, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCommunities } from '@/hooks/useCommunities';
import { useUserCommunityMembership } from '@/hooks/useUserCommunityMembership';
import { useJoinCommunity } from '@/hooks/useJoinCommunity';
import { useAuthor } from '@/hooks/useAuthor';
import { LoginArea } from '@/components/auth/LoginArea';
import { useToast } from '@/hooks/useToast';
import { genUserName } from '@/lib/genUserName';

export function JoinCommunity() {
  const { naddr } = useParams<{ naddr: string }>();
  const [joinMessage, setJoinMessage] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const { user } = useCurrentUser();
  const { data: communities } = useCommunities();
  const { mutate: joinCommunity } = useJoinCommunity();
  const { toast } = useToast();

  // Decode the naddr to get community information
  let communityId: string | null = null;
  let decodedData: ReturnType<typeof nip19.decode> | null = null;

  try {
    if (naddr) {
      decodedData = nip19.decode(naddr);
      if (decodedData.type === 'naddr') {
        const { kind, pubkey, identifier } = decodedData.data;
        communityId = `${kind}:${pubkey}:${identifier}`;
      }
    }
  } catch (error) {
    console.error('Failed to decode naddr:', error);
  }

  // Find the community
  const community = communities?.find(c => c.id === communityId);
  const creatorAuthor = useAuthor(community?.creator || '');

  // Check user's membership status
  const { data: membershipStatus } = useUserCommunityMembership(communityId || '');

  // If invalid naddr or community not found, redirect to 404
  if (!naddr || !decodedData || decodedData.type !== 'naddr') {
    return <Navigate to="/404" replace />;
  }

  const handleJoinRequest = async () => {
    if (!communityId || !user) return;

    setIsJoining(true);

    joinCommunity(
      {
        communityId,
        message: joinMessage.trim() || `I would like to join ${community?.name || 'this community'}.`
      },
      {
        onSuccess: () => {
          toast({
            title: 'Join Request Sent',
            description: 'Your request to join the community has been sent to the moderators.',
          });
          setJoinMessage('');
        },
        onError: (error) => {
          toast({
            title: 'Failed to Send Request',
            description: error instanceof Error ? error.message : 'An error occurred while sending your request.',
            variant: 'destructive',
          });
        },
        onSettled: () => {
          setIsJoining(false);
        },
      }
    );
  };

  const getMembershipStatusDisplay = () => {
    switch (membershipStatus) {
      case 'owner':
        return {
          icon: <Crown className="h-5 w-5 text-yellow-500" />,
          text: 'Community Owner',
          description: 'You own this community',
          variant: 'default' as const,
        };
      case 'moderator':
        return {
          icon: <Shield className="h-5 w-5 text-blue-500" />,
          text: 'Moderator',
          description: 'You are a moderator of this community',
          variant: 'secondary' as const,
        };
      case 'approved':
        return {
          icon: <CheckCircle className="h-5 w-5 text-green-500" />,
          text: 'Member',
          description: 'You are already a member of this community',
          variant: 'outline' as const,
        };
      case 'pending':
        return {
          icon: <Clock className="h-5 w-5 text-orange-500" />,
          text: 'Request Pending',
          description: 'Your join request is awaiting approval',
          variant: 'outline' as const,
        };
      case 'declined':
        return {
          icon: <XCircle className="h-5 w-5 text-red-500" />,
          text: 'Request Declined',
          description: 'Your previous join request was declined',
          variant: 'outline' as const,
        };
      case 'banned':
        return {
          icon: <XCircle className="h-5 w-5 text-red-500" />,
          text: 'Banned',
          description: 'You are banned from this community',
          variant: 'destructive' as const,
        };
      default:
        return null;
    }
  };

  const statusDisplay = getMembershipStatusDisplay();
  const canJoin = user && !membershipStatus;
  const canViewCommunity = membershipStatus === 'owner' || membershipStatus === 'moderator' || membershipStatus === 'approved';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Community Information */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={community?.image} />
                <AvatarFallback className="text-lg">
                  {community?.name?.slice(0, 2).toUpperCase() || 'C'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-2xl">
                  {community?.name || 'Community'}
                </CardTitle>
                <CardDescription className="mt-1">
                  {community?.description || 'A Nostr community'}
                </CardDescription>
                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{(community?.moderators.length || 0) + 1} members</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Crown className="h-4 w-4" />
                    <span>
                      Created by {creatorAuthor.data?.metadata?.name || genUserName(community?.creator || '')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Membership Status */}
        {statusDisplay && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                {statusDisplay.icon}
                <div>
                  <Badge variant={statusDisplay.variant} className="mb-1">
                    {statusDisplay.text}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    {statusDisplay.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Login Required */}
        {!user && (
          <Card>
            <CardHeader>
              <CardTitle>Login Required</CardTitle>
              <CardDescription>
                You need to be logged in to join communities on Nostr.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoginArea className="w-full" />
            </CardContent>
          </Card>
        )}

        {/* Join Request Form */}
        {canJoin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Request to Join
              </CardTitle>
              <CardDescription>
                Send a request to join {community?.name || 'this community'}.
                The community moderators will review your request.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="join-message">
                  Message to Moderators (Optional)
                </Label>
                <Textarea
                  id="join-message"
                  placeholder="Tell the moderators why you'd like to join this community..."
                  value={joinMessage}
                  onChange={(e) => setJoinMessage(e.target.value)}
                  rows={3}
                />
              </div>
              <Button
                onClick={handleJoinRequest}
                disabled={isJoining}
                className="w-full"
              >
                {isJoining ? 'Sending Request...' : 'Send Join Request'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              {canViewCommunity && (
                <Button asChild className="flex-1">
                  <Link to={`/${naddr}`}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Community
                  </Link>
                </Button>
              )}

              <Button variant="outline" asChild className="flex-1">
                <Link to="/communities">
                  <Users className="h-4 w-4 mr-2" />
                  Browse Communities
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Community Details */}
        {community && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">About This Community</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {community.description && (
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    {community.description}
                  </p>
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium mb-1">Community ID</h4>
                  <p className="text-muted-foreground font-mono text-xs break-all">
                    {community.id}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Relays</h4>
                  <p className="text-muted-foreground">
                    {community.relays.length > 0
                      ? `${community.relays.length} relay${community.relays.length > 1 ? 's' : ''}`
                      : 'Default relays'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}