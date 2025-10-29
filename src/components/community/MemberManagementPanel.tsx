import { useState } from "react";
import { Users, UserCheck, UserX, UserMinus, MoreHorizontal, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useDataManager, useDataManagerCommunityMembers } from "@/components/DataManagerProvider";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";
import { useToast } from "@/hooks/useToast";

interface MemberManagementPanelProps {
  communityId: string | null;
}

interface MemberItemProps {
  pubkey: string;
  status: 'approved' | 'declined' | 'banned';
  onStatusChange: (pubkey: string, newStatus: 'approved' | 'declined' | 'banned') => void;
  isProcessing: boolean;
}

function MemberItem({ pubkey, status, onStatusChange, isProcessing }: MemberItemProps) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approved' | 'declined' | 'banned' | null>(null);

  const displayName = metadata?.name || genUserName(pubkey);
  const profileImage = metadata?.picture;

  const handleStatusChange = (newStatus: 'approved' | 'declined' | 'banned') => {
    setPendingAction(newStatus);
    setShowConfirmDialog(true);
  };

  const confirmStatusChange = () => {
    if (pendingAction) {
      onStatusChange(pubkey, pendingAction);
    }
    setShowConfirmDialog(false);
    setPendingAction(null);
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><UserCheck className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'declined':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"><UserX className="w-3 h-3 mr-1" />Declined</Badge>;
      case 'banned':
        return <Badge variant="destructive"><UserMinus className="w-3 h-3 mr-1" />Banned</Badge>;
    }
  };

  const getActionText = () => {
    switch (pendingAction) {
      case 'approved':
        return status === 'approved' ? 'remove from approved list' : 'approve this member';
      case 'declined':
        return status === 'declined' ? 'remove from declined list' : 'decline this member';
      case 'banned':
        return status === 'banned' ? 'unban this member' : 'ban this member';
      default:
        return '';
    }
  };

  return (
    <>
      <Card className="mb-3">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={profileImage} alt={displayName} />
                <AvatarFallback className="bg-indigo-600 text-white text-sm">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div>
                <h4 className="font-medium text-sm">{displayName}</h4>
                <div className="mt-1">
                  {getStatusBadge()}
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" disabled={isProcessing}>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {status !== 'approved' && (
                  <DropdownMenuItem onClick={() => handleStatusChange('approved')}>
                    <UserCheck className="w-4 h-4 mr-2" />
                    Approve
                  </DropdownMenuItem>
                )}
                {status !== 'declined' && (
                  <DropdownMenuItem onClick={() => handleStatusChange('declined')}>
                    <UserX className="w-4 h-4 mr-2" />
                    Decline
                  </DropdownMenuItem>
                )}
                {status !== 'banned' && (
                  <DropdownMenuItem onClick={() => handleStatusChange('banned')} className="text-red-600">
                    <UserMinus className="w-4 h-4 mr-2" />
                    Ban
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {getActionText()}? This action will update the community member lists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function MemberManagementPanel({ communityId }: MemberManagementPanelProps) {
  const { data: members, isLoading } = useDataManagerCommunityMembers(communityId);
  const { communities: dataManager } = useDataManager();
  const { toast } = useToast();
  const [processingUser, setProcessingUser] = useState<string | null>(null);

  const handleStatusChange = async (pubkey: string, newStatus: 'approved' | 'declined' | 'banned') => {
    if (!communityId) return;

    setProcessingUser(pubkey);

    try {
      switch (newStatus) {
        case 'approved':
          await dataManager.approveMember(communityId, pubkey);
          break;
        case 'declined':
          await dataManager.declineMember(communityId, pubkey);
          break;
        case 'banned':
          await dataManager.banMember(communityId, pubkey);
          break;
      }

      toast({
        title: "Member Status Updated",
        description: `Member has been ${newStatus}.`,
      });
    } catch (error) {
      toast({
        title: "Failed to Update Status",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setProcessingUser(null);
    }
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

  // DataManager returns members with role information for approved members
  const approvedMembers = members?.filter(member => member.role === 'member' || member.role === 'moderator' || member.role === 'owner').map(member => member.pubkey) || [];

  // Get declined and banned members from DataManager
  const community = communityId ? dataManager.communities.get(communityId) : null;
  const declinedMembers = community?.declinedMembers?.members || [];
  const bannedMembers = community?.bannedMembers?.members || [];

  const isProcessing = processingUser !== null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex-shrink-0">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Member Management</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="approved" className="h-full flex flex-col">
          <div className="px-4 pt-4 flex-shrink-0">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="approved" className="text-xs">
                Approved ({approvedMembers.length})
              </TabsTrigger>
              <TabsTrigger value="declined" className="text-xs">
                Declined ({declinedMembers.length})
              </TabsTrigger>
              <TabsTrigger value="banned" className="text-xs">
                Banned ({bannedMembers.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="approved" className="h-full mt-4">
              <ScrollArea className="h-full">
                <div className="px-4 pb-4">
                  {isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="animate-pulse">
                          <CardContent className="p-4">
                            <div className="flex items-center space-x-3">
                              <Skeleton className="w-10 h-10 rounded-full" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-6 w-20" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : approvedMembers.length > 0 ? (
                    <div>
                      {approvedMembers.map((pubkey) => (
                        <MemberItem
                          key={pubkey}
                          pubkey={pubkey}
                          status="approved"
                          onStatusChange={handleStatusChange}
                          isProcessing={processingUser === pubkey || isProcessing}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-semibold mb-2">No Approved Members</h3>
                      <p className="text-sm">
                        Approved members will appear here once you approve join requests.
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="declined" className="h-full mt-4">
              <ScrollArea className="h-full">
                <div className="px-4 pb-4">
                  {isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="animate-pulse">
                          <CardContent className="p-4">
                            <div className="flex items-center space-x-3">
                              <Skeleton className="w-10 h-10 rounded-full" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-6 w-20" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : declinedMembers.length > 0 ? (
                    <div>
                      {declinedMembers.map((pubkey) => (
                        <MemberItem
                          key={pubkey}
                          pubkey={pubkey}
                          status="declined"
                          onStatusChange={handleStatusChange}
                          isProcessing={processingUser === pubkey || isProcessing}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <UserX className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-semibold mb-2">No Declined Members</h3>
                      <p className="text-sm">
                        Declined members will appear here when you decline join requests.
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="banned" className="h-full mt-4">
              <ScrollArea className="h-full">
                <div className="px-4 pb-4">
                  {isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="animate-pulse">
                          <CardContent className="p-4">
                            <div className="flex items-center space-x-3">
                              <Skeleton className="w-10 h-10 rounded-full" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-6 w-20" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : bannedMembers.length > 0 ? (
                    <div>
                      {bannedMembers.map((pubkey) => (
                        <MemberItem
                          key={pubkey}
                          pubkey={pubkey}
                          status="banned"
                          onStatusChange={handleStatusChange}
                          isProcessing={processingUser === pubkey || isProcessing}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <UserMinus className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-semibold mb-2">No Banned Members</h3>
                      <p className="text-sm">
                        Banned members will appear here when you ban users from the community.
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}