import { useState } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Crown, Shield, Users, ExternalLink, Settings, Share2 } from "lucide-react";
import { useUserCommunities } from "@/hooks/useUserCommunities";
import { useLeaveCommunity } from "@/hooks/useLeaveCommunity";
import { CommunityDiscovery } from "@/components/discovery/CommunityDiscovery";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { LoginArea } from "@/components/auth/LoginArea";
import { CommunityShareDialog } from "@/components/community/CommunityShareDialog";

export function Communities() {
  const { data: userCommunities, isLoading } = useUserCommunities();
  const { mutate: leaveCommunity } = useLeaveCommunity();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("my-communities");

  const handleLeaveCommunity = (communityId: string, communityName: string) => {
    leaveCommunity(
      { communityId, message: `Leaving ${communityName}` },
      {
        onSuccess: () => {
          toast({
            title: "Leave Request Sent",
            description: `Your request to leave ${communityName} has been sent.`,
          });
        },
        onError: (error) => {
          toast({
            title: "Failed to Leave",
            description: error instanceof Error ? error.message : "An error occurred",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Login Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              You need to be logged in to view and manage your communities.
            </p>
            <LoginArea className="w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Communities</h1>
          <p className="text-muted-foreground">
            Manage your community memberships and discover new communities
          </p>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="my-communities">My Communities</TabsTrigger>
            <TabsTrigger value="discover">Discover</TabsTrigger>
          </TabsList>

          <TabsContent value="my-communities" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Your Communities</h2>
              <Badge variant="outline">
                {userCommunities?.length || 0} communities
              </Badge>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-muted rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <div className="h-5 bg-muted rounded w-3/4" />
                          <div className="h-4 bg-muted rounded w-1/2" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="h-4 bg-muted rounded w-full" />
                        <div className="h-4 bg-muted rounded w-2/3" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : userCommunities && userCommunities.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userCommunities.map((community) => (
                  <Card key={community.id} className="hover:bg-muted/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          {community.image ? (
                            <Avatar className="w-12 h-12">
                              <AvatarImage src={community.image} alt={community.name} />
                              <AvatarFallback>
                                {community.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-semibold">
                              {community.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg truncate">
                              {community.name}
                            </CardTitle>
                            <div className="flex items-center space-x-2">
                              <Badge
                                variant={
                                  community.membershipStatus === 'owner' ? 'default' :
                                  community.membershipStatus === 'moderator' ? 'secondary' :
                                  'outline'
                                }
                                className="text-xs"
                              >
                                {community.membershipStatus === 'owner' && <Crown className="w-3 h-3 mr-1" />}
                                {community.membershipStatus === 'moderator' && <Shield className="w-3 h-3 mr-1" />}
                                {community.membershipStatus === 'approved' ? 'Member' : community.membershipStatus}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0 space-y-4">
                      {community.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {community.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                          <Users className="w-4 h-4" />
                          <span>{community.moderators.length + 1} members</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm">
                            <ExternalLink className="w-4 h-4 mr-1" />
                            View
                          </Button>

                          <CommunityShareDialog community={community}>
                            <Button variant="outline" size="sm">
                              <Share2 className="w-4 h-4 mr-1" />
                              Share
                            </Button>
                          </CommunityShareDialog>

                          {(community.membershipStatus === 'owner' || community.membershipStatus === 'moderator') && (
                            <Button variant="outline" size="sm" asChild>
                              <Link to={`/communities/${encodeURIComponent(community.id)}/manage`}>
                                <Settings className="w-4 h-4 mr-1" />
                                Manage
                              </Link>
                            </Button>
                          )}

                          {community.membershipStatus !== 'owner' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleLeaveCommunity(community.id, community.name)}
                            >
                              Leave
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 px-8 text-center">
                  <div className="max-w-sm mx-auto space-y-4">
                    <Users className="w-16 h-16 mx-auto text-muted-foreground opacity-50" />
                    <div>
                      <h3 className="text-lg font-semibold mb-2">No Communities Yet</h3>
                      <p className="text-muted-foreground text-sm">
                        You haven't joined any communities yet. Discover and join communities that interest you!
                      </p>
                    </div>
                    <Button onClick={() => setSelectedTab("discover")}>
                      Discover Communities
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="discover">
            <CommunityDiscovery />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}