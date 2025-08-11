import { useState } from 'react';
import { UserPlus, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { LoginArea } from '@/components/auth/LoginArea';
import { useToast } from '@/hooks/useToast';

interface MembershipCTAProps {
  _communityId: string;
  onJoinRequest: () => void;
  className?: string;
}

export function MembershipCTA({ _communityId, onJoinRequest, className }: MembershipCTAProps) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinRequest = async () => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to request to join this community.",
        variant: "destructive",
      });
      return;
    }

    setIsJoining(true);
    try {
      await onJoinRequest();
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <Card className={`${className || ''}`}>
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center">
              <Lock className="w-6 h-6 text-orange-500" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Join to Participate</h3>
            <p className="text-sm text-muted-foreground">
              You need to be an approved member to send messages in this community.
            </p>
          </div>

          {!user ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Log in to request membership
              </p>
              <LoginArea className="w-full" />
            </div>
          ) : (
            <Button
              onClick={handleJoinRequest}
              disabled={isJoining}
              className="w-full"
            >
              {isJoining ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Sending Request...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Request to Join
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}