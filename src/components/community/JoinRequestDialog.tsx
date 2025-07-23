import { useState } from 'react';
import { Users, Crown, UserPlus, CheckCircle, Clock, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

interface JoinRequestDialogProps {
  communityId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoinSuccess?: (communityId: string) => void;
}

export function JoinRequestDialog({ 
  communityId, 
  open, 
  onOpenChange, 
  onJoinSuccess 
}: JoinRequestDialogProps) {
  const [joinMessage, setJoinMessage] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  
  const { user } = useCurrentUser();
  const { data: communities } = useCommunities();
  const { mutate: joinCommunity } = useJoinCommunity();
  const { toast } = useToast();

  // Find the community
  const community = communities?.find(c => c.id === communityId);
  const creatorAuthor = useAuthor(community?.creator || '');
  
  // Check user's membership status
  const { data: membershipStatus } = useUserCommunityMembership(communityId || '');

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
          onJoinSuccess?.(communityId);
          onOpenChange(false);
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
          canJoin: false,
        };
      case 'moderator':
        return {
          icon: <Crown className="h-5 w-5 text-blue-500" />,
          text: 'Moderator',
          description: 'You are a moderator of this community',
          variant: 'secondary' as const,
          canJoin: false,
        };
      case 'approved':
        return {
          icon: <CheckCircle className="h-5 w-5 text-green-500" />,
          text: 'Member',
          description: 'You are already a member of this community',
          variant: 'outline' as const,
          canJoin: false,
        };
      case 'pending':
        return {
          icon: <Clock className="h-5 w-5 text-orange-500" />,
          text: 'Request Pending',
          description: 'Your join request is awaiting approval',
          variant: 'outline' as const,
          canJoin: false,
        };
      case 'declined':
        return {
          icon: <XCircle className="h-5 w-5 text-red-500" />,
          text: 'Request Declined',
          description: 'Your previous join request was declined',
          variant: 'outline' as const,
          canJoin: false,
        };
      case 'banned':
        return {
          icon: <XCircle className="h-5 w-5 text-red-500" />,
          text: 'Banned',
          description: 'You are banned from this community',
          variant: 'destructive' as const,
          canJoin: false,
        };
      default:
        return {
          icon: <UserPlus className="h-5 w-5 text-blue-500" />,
          text: 'Not a Member',
          description: 'You can request to join this community',
          variant: 'outline' as const,
          canJoin: true,
        };
    }
  };

  if (!community) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Community Not Found</DialogTitle>
          </DialogHeader>
          <div className="text-center py-6">
            <Users className="h-16 w-16 mx-auto text-muted-foreground opacity-50 mb-4" />
            <p className="text-muted-foreground">
              This community doesn't exist or hasn't been loaded yet.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const statusDisplay = getMembershipStatusDisplay();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Join {community.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Community Information */}
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={community.image} />
              <AvatarFallback className="text-lg">
                {community.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-xl font-semibold">{community.name}</h3>
              <p className="text-muted-foreground mt-1">
                {community.description || 'A Nostr community'}
              </p>
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{(community.moderators.length || 0) + 1} members</span>
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

          <Separator />

          {/* Membership Status */}
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
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

          {/* Login Required */}
          {!user && (
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Login Required</h4>
              <p className="text-sm text-muted-foreground mb-4">
                You need to be logged in to join communities on Nostr.
              </p>
              <LoginArea className="w-full" />
            </div>
          )}

          {/* Join Request Form */}
          {user && statusDisplay.canJoin && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="join-message" className="text-base font-medium">
                  Message to Moderators (Optional)
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Tell the moderators why you'd like to join this community.
                </p>
              </div>
              <Textarea
                id="join-message"
                placeholder="I would like to join this community because..."
                value={joinMessage}
                onChange={(e) => setJoinMessage(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {user && statusDisplay.canJoin && (
              <Button 
                onClick={handleJoinRequest} 
                disabled={isJoining}
              >
                {isJoining ? 'Sending Request...' : 'Send Join Request'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}