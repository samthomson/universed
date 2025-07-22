import { useState } from "react";
import { Check, X, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useJoinRequests } from "@/hooks/useJoinRequests";
import { useManageMembers } from "@/hooks/useManageMembers";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";
import { useToast } from "@/hooks/useToast";
import type { JoinRequest } from "@/hooks/useJoinRequests";

interface JoinRequestsProps {
  communityId: string | null;
}

interface JoinRequestItemProps {
  request: JoinRequest;
  onApprove: (pubkey: string) => void;
  onDecline: (pubkey: string) => void;
  isProcessing: boolean;
}

function JoinRequestItem({ request, onApprove, onDecline, isProcessing }: JoinRequestItemProps) {
  const author = useAuthor(request.requesterPubkey);
  const metadata = author.data?.metadata;

  const displayName = metadata?.name || genUserName(request.requesterPubkey);
  const profileImage = metadata?.picture;

  const formatTimeAgo = (timestamp: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={profileImage} alt={displayName} />
            <AvatarFallback className="bg-indigo-600 text-white text-sm">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-medium text-sm">{displayName}</h4>
                <p className="text-xs text-muted-foreground">
                  {formatTimeAgo(request.createdAt)}
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                Pending
              </Badge>
            </div>

            {request.message && (
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {request.message}
              </p>
            )}

            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                onClick={() => onApprove(request.requesterPubkey)}
                disabled={isProcessing}
                className="h-8"
              >
                <Check className="w-3 h-3 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDecline(request.requesterPubkey)}
                disabled={isProcessing}
                className="h-8"
              >
                <X className="w-3 h-3 mr-1" />
                Decline
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function JoinRequestsPanel({ communityId }: JoinRequestsProps) {
  const { data: joinRequests, isLoading } = useJoinRequests(communityId);
  const { addMember, isAddingMember } = useManageMembers();
  const { toast } = useToast();
  const [processingUser, setProcessingUser] = useState<string | null>(null);

  const handleApprove = (pubkey: string) => {
    if (!communityId) return;

    setProcessingUser(pubkey);
    addMember(
      { communityId, memberPubkey: pubkey },
      {
        onSuccess: () => {
          toast({
            title: "Member Approved",
            description: "The user has been added to the community.",
          });
          setProcessingUser(null);
        },
        onError: (error) => {
          toast({
            title: "Failed to Approve",
            description: error instanceof Error ? error.message : "An error occurred",
            variant: "destructive",
          });
          setProcessingUser(null);
        },
      }
    );
  };

  const handleDecline = (_pubkey: string) => {
    // TODO: Implement decline functionality (Kind 34552 - Declined Members List)
    toast({
      title: "Decline Feature",
      description: "Decline functionality will be implemented soon.",
      variant: "default",
    });
  };

  if (!communityId) {
    return (
      <div className="p-4">
        <div className="text-center text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No community selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">
              Join Requests
            </span>
          </div>
          {joinRequests && joinRequests.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {joinRequests.length}
            </Badge>
          )}
        </div>
      </div>

      {/* Requests List */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-4 w-full" />
                      <div className="flex space-x-2">
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-8 w-20" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : joinRequests && joinRequests.length > 0 ? (
          <div>
            {joinRequests.map((request) => (
              <JoinRequestItem
                key={request.event.id}
                request={request}
                onApprove={handleApprove}
                onDecline={handleDecline}
                isProcessing={processingUser === request.requesterPubkey || isAddingMember}
              />
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Pending Requests</h3>
            <p className="text-sm">
              All join requests have been processed or there are no new requests.
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}