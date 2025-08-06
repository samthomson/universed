import { useState, useRef, useEffect } from "react";
import { Settings, Users, Shield, BarChart3, FileText, Trash2, Crown, Clock, AlertTriangle, Share2, Upload, X, Menu } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useCommunities, type Community } from "@/hooks/useCommunities";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCommunityMembers } from "@/hooks/useCommunityMembers";
import { useJoinRequests } from "@/hooks/useJoinRequests";
import { useModerationLogs, useModerationStats } from "@/hooks/useModerationLogs";
import { useReports } from "@/hooks/useReporting";
import { useAuthor } from "@/hooks/useAuthor";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useToast } from "@/hooks/useToast";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useManageMembers } from "@/hooks/useManageMembers";
import { genUserName } from "@/lib/genUserName";

import { nip19 } from 'nostr-tools';
import { Copy, Check, QrCode, Download } from 'lucide-react';
import QRCode from 'qrcode';

interface CommunitySettingsProps {
  communityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommunitySettings({ communityId, open, onOpenChange }: CommunitySettingsProps) {
  const { data: communities } = useCommunities();
  const { user } = useCurrentUser();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    image: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { mutateAsync: createEvent } = useNostrPublish();
  const { toast } = useToast();
  const { addMember, declineMember, isAddingMember, isDecliningMember } = useManageMembers();
  const [approvingMembers, setApprovingMembers] = useState<Set<string>>(new Set());
  const [decliningMembers, setDecliningMembers] = useState<Set<string>>(new Set());

  // Real data hooks
  const { data: members } = useCommunityMembers(communityId);
  const { data: joinRequests, isRefetching: isRefetchingRequests } = useJoinRequests(communityId);
  const { data: moderationLogs } = useModerationLogs(communityId || '');
  const moderationStats = useModerationStats(communityId || '');
  const { data: reports } = useReports(communityId);

  const community = communities?.find(c => c.id === communityId);

  // Simple handlers that track which member is being processed
  const handleApprove = (memberPubkey: string) => {
    if (!community) return;
    setApprovingMembers(prev => new Set([...prev, memberPubkey]));
    addMember({ 
      communityId: community.id, 
      memberPubkey,
    });
  };

  const handleDecline = (memberPubkey: string) => {
    if (!community) return;
    setDecliningMembers(prev => new Set([...prev, memberPubkey]));
    declineMember({ 
      communityId: community.id, 
      memberPubkey,
    });
  };

  // Clear individual member states when global operations complete
  useEffect(() => {
    if (!isAddingMember) {
      setApprovingMembers(new Set());
    }
  }, [isAddingMember]);

  useEffect(() => {
    if (!isDecliningMember) {
      setDecliningMembers(new Set());
    }
  }, [isDecliningMember]);

  // Initialize form data when community changes
  useEffect(() => {
    if (community) {
      setFormData({
        name: community.name,
        description: community.description || "",
        image: community.image || "",
      });
    }
  }, [community]);

  if (!community) {
    return null;
  }

  // Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "Error",
          description: "Image must be smaller than 5MB",
          variant: "destructive",
        });
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast({
          title: "Error",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview("");
    setFormData(prev => ({ ...prev, image: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle join request approval
  const handleApproveRequest = async (requesterPubkey: string) => {
    if (!community) return;

    try {
      addMember({
        communityId: community.id,
        memberPubkey: requesterPubkey
      });
      toast({
        title: "Success",
        description: "Join request approved successfully!",
      });
    } catch (error) {
      console.error("Failed to approve join request:", error);
      toast({
        title: "Error",
        description: "Failed to approve join request",
        variant: "destructive",
      });
    }
  };

  // Handle join request decline
  const handleDeclineRequest = async (requesterPubkey: string) => {
    if (!community) return;

    try {
      declineMember({
        communityId: community.id,
        memberPubkey: requesterPubkey
      });
      toast({
        title: "Success",
        description: "Join request declined successfully!",
      });
    } catch (error) {
      console.error("Failed to decline join request:", error);
      toast({
        title: "Error",
        description: "Failed to decline join request",
        variant: "destructive",
      });
    }
  };

  const handleSaveChanges = async () => {
    if (!user || !community) return;

    try {
      let imageUrl = formData.image;

      // Upload image if a file is selected
      if (imageFile) {
        try {
          const [[_, url]] = await uploadFile(imageFile);
          imageUrl = url;
        } catch (error) {
          console.error("Failed to upload image:", error);
          toast({
            title: "Error",
            description: "Failed to upload community icon",
            variant: "destructive",
          });
          return;
        }
      }

      // Get the d tag from the original event
      const dTag = community.event.tags.find(([name]) => name === 'd')?.[1] || '';

      const tags = [
        ["d", dTag],
        ["name", formData.name.trim()],
      ];

      if (formData.description.trim()) {
        tags.push(["description", formData.description.trim()]);
      }

      if (imageUrl) {
        tags.push(["image", imageUrl]);
      }

      // Preserve existing moderators
      community.moderators.forEach(moderatorPubkey => {
        tags.push(["p", moderatorPubkey, "", "moderator"]);
      });

      // Add creator as moderator if not already included
      if (!community.moderators.includes(community.creator)) {
        tags.push(["p", community.creator, "", "moderator"]);
      }

      await createEvent({
        kind: 34550,
        content: "",
        tags,
      });

      toast({
        title: "Success",
        description: "Community settings updated successfully!",
      });

      // Reset image upload state
      setImageFile(null);
      setImagePreview("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

    } catch (error) {
      console.error("Failed to update community:", error);
      toast({
        title: "Error",
        description: "Failed to update community settings",
        variant: "destructive",
      });
    }
  };

  // Check if user is admin/mod
  const isAdmin = user?.pubkey === community.creator;
  const isModerator = community.moderators.includes(user?.pubkey || '');

  if (!isAdmin && !isModerator) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Access Denied</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            You don't have permission to access community settings.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  // Calculate analytics from real data
  const totalMembers = members?.length || 0;
  const onlineMembers = members?.filter(m => m.isOnline).length || 0;
  const pendingRequests = joinRequests?.length || 0;
  const totalReports = reports?.length || 0;

  // Tab configuration for mobile menu
  const tabs = [
    { value: "overview", label: "Overview", icon: Settings },
    { value: "sharing", label: "Sharing", icon: Share2 },
    { value: "moderation", label: "Moderation", icon: Shield },
    { value: "members", label: "Members", icon: Users },
    { value: "analytics", label: "Analytics", icon: BarChart3 },
    { value: "audit", label: "Audit Log", icon: FileText },
  ];

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setMobileMenuOpen(false); // Close mobile menu when tab is selected
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {community.name} Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          {/* Desktop Tab Navigation */}
          {!isMobile && (
            <TabsList className="grid w-full grid-cols-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-1">
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          )}

          {/* Mobile Tab Navigation */}
          {isMobile && (
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Menu className="w-4 h-4" />
                      Menu
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-72">
                    <SheetHeader>
                      <SheetTitle>Settings Menu</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6 space-y-2">
                      {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.value;
                        return (
                          <Button
                            key={tab.value}
                            variant={isActive ? "default" : "ghost"}
                            className="w-full justify-start gap-3"
                            onClick={() => handleTabChange(tab.value)}
                          >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                          </Button>
                        );
                      })}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
              <div className="text-sm font-medium text-muted-foreground">
                {tabs.find(tab => tab.value === activeTab)?.label}
              </div>
            </div>
          )}

          <ScrollArea className="h-[70vh] mt-4">
            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Community Information</CardTitle>
                  <CardDescription>
                    Basic settings for your community
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="community-icon">Community Icon</Label>
                    <div className="flex items-center gap-4">
                      <Avatar className="w-16 h-16">
                        <AvatarImage src={imagePreview || formData.image || community.image} />
                        <AvatarFallback className="text-lg">
                          {community.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading || !isAdmin}
                          className="flex items-center gap-2"
                        >
                          <Upload className="w-4 h-4" />
                          {isUploading ? "Uploading..." : "Upload Icon"}
                        </Button>
                        {(imagePreview || formData.image || community.image) && isAdmin && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={removeImage}
                            className="flex items-center gap-2"
                          >
                            <X className="w-4 h-4" />
                            Remove
                          </Button>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Upload a square image (recommended: 256x256px, max 5MB). Only admins can change the community icon.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="community-name">Community Name</Label>
                    <Input
                      id="community-name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="community-description">Description</Label>
                    <Textarea
                      id="community-description"
                      placeholder="Describe your community..."
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="public-community" />
                    <Label htmlFor="public-community">Public Community</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="require-approval" />
                    <Label htmlFor="require-approval">Require approval to join</Label>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-red-600">Danger Zone</CardTitle>
                  <CardDescription>
                    Irreversible actions for this community
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="flex items-center gap-2">
                        <Trash2 className="w-4 h-4" />
                        Delete Community
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the community
                          and remove all associated data.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700">
                          Delete Community
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sharing" className="space-y-6">
              <CommunityShareContent community={community} />
            </TabsContent>

            <TabsContent value="moderation" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Auto-Moderation</CardTitle>
                  <CardDescription>
                    Automatically moderate content based on rules
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pb-0">
                  <div className="flex items-center space-x-2">
                    <Switch id="auto-delete-spam" />
                    <Label htmlFor="auto-delete-spam">Auto-delete spam messages</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="filter-profanity" />
                    <Label htmlFor="filter-profanity">Filter profanity</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="require-verification" />
                    <Label htmlFor="require-verification">Require phone verification</Label>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Moderation Queue</CardTitle>
                  <CardDescription>
                    Review flagged content and user reports ({totalReports} pending)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {reports && reports.length > 0 ? (
                      reports.slice(0, 5).map((report) => (
                        <ReportItem key={report.id} report={report} />
                      ))
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No pending reports</p>
                      </div>
                    )}
                    {reports && reports.length > 5 && (
                      <Button variant="outline" className="w-full">
                        View All {reports.length} Reports
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="members" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Member Management</CardTitle>
                  <CardDescription>
                    Manage community members and their roles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {members && members.length > 0 ? (
                      members.slice(0, 10).map((member) => (
                        <MemberItem key={member.pubkey} member={member} />
                      ))
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No members found</p>
                      </div>
                    )}
                    {members && members.length > 10 && (
                      <Button variant="outline" className="w-full">
                        View All {members.length} Members
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Join Requests</CardTitle>
                  <CardDescription>
                    Pending requests to join the community
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {isRefetchingRequests ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                        <p>Updating...</p>
                      </div>
                    ) : joinRequests && joinRequests.length > 0 ? (
                      joinRequests.map((request) => (
                        <JoinRequestItem
                          key={request.event.id}
                          request={request}
                          onApprove={() => handleApproveRequest(request.requesterPubkey)}
                          onDecline={() => handleDeclineRequest(request.requesterPubkey)}
                          isApproving={isAddingMember}
                          isDeclining={isDecliningMember}
                        />
                      ))
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No pending join requests</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Members</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalMembers}</div>
                    <p className="text-xs text-muted-foreground">Community members</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Join Requests</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{pendingRequests}</div>
                    <p className="text-xs text-muted-foreground">Pending approval</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Online Members</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{onlineMembers}</div>
                    <p className="text-xs text-muted-foreground">Currently active</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Mod Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{moderationStats.totalActions}</div>
                    <p className="text-xs text-muted-foreground">Total actions taken</p>
                  </CardContent>
                </Card>
              </div>

              {moderationStats.totalActions > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Moderation Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(moderationStats.actionsByType).map(([action, count]) => (
                        <div key={action} className="flex justify-between">
                          <span className="capitalize text-sm">{action}:</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="audit" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Audit Log</CardTitle>
                  <CardDescription>
                    Recent moderation and administrative actions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {moderationLogs && moderationLogs.length > 0 ? (
                      moderationLogs.slice(0, 10).map((log) => (
                        <ModerationLogItem key={log.id} log={log} />
                      ))
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No moderation actions recorded</p>
                      </div>
                    )}
                    {moderationLogs && moderationLogs.length > 10 && (
                      <Button variant="outline" className="w-full">
                        View All {moderationLogs.length} Actions
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>

          <Separator className="my-4" />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {isAdmin && (
              <Button onClick={handleSaveChanges} disabled={isUploading}>
                {isUploading ? "Uploading..." : "Save Changes"}
              </Button>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Component for sharing content (extracted from CommunityShareDialog)
function CommunityShareContent({ community }: { community: Community }) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isGeneratingQR, setIsGeneratingQR] = useState(true);
  const { toast } = useToast();

  // Parse community ID to get the components for naddr
  const [kind, pubkey, identifier] = community.id.split(':');

  // Generate naddr for the community
  const naddr = nip19.naddrEncode({
    kind: parseInt(kind),
    pubkey,
    identifier,
    relays: community.relays.length > 0 ? community.relays : undefined,
  });

  // Generate shareable URLs
  const baseUrl = window.location.origin;
  const joinUrl = `${baseUrl}/join/${naddr}`;

  // Auto-generate QR code when component mounts
  useEffect(() => {
    const generateQRCode = async () => {
      try {
        setIsGeneratingQR(true);
        const qrDataUrl = await QRCode.toDataURL(joinUrl, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        setQrCodeDataUrl(qrDataUrl);
      } catch (error) {
        console.error('Failed to generate QR code:', error);
        toast({
          title: 'Error',
          description: 'Failed to generate QR code',
          variant: 'destructive',
        });
      } finally {
        setIsGeneratingQR(false);
      }
    };

    generateQRCode();
  }, [joinUrl, toast]);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({
        title: 'Copied to clipboard',
        description: 'The link has been copied to your clipboard.',
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy to clipboard. Please copy manually.',
        variant: 'destructive',
      });
    }
  };



  const downloadQRCode = () => {
    if (!qrCodeDataUrl) return;

    const link = document.createElement('a');
    link.download = `${community.name}-join-qr.png`;
    link.href = qrCodeDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Downloaded',
      description: 'QR code has been downloaded',
    });
  };

  const CopyButton = ({ text, field, className = '' }: { text: string; field: string; className?: string }) => (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={() => copyToClipboard(text, field)}
    >
      {copiedField === field ? (
        <Check className="h-4 w-4" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );

  return (
    <div className="space-y-4">
      {/* Join Link */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="join-url" className="text-base font-medium">
            Join Link
          </Label>
          <p className="text-sm text-muted-foreground mb-2">
            Direct link for people to request to join your community
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            id="join-url"
            value={joinUrl}
            readOnly
            className="font-mono text-sm"
          />
          <CopyButton text={joinUrl} field="join-url" />
        </div>
      </div>

      {/* Nostr Address */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="naddr" className="text-base font-medium">
            Nostr Address (naddr)
          </Label>
          <p className="text-sm text-muted-foreground mb-2">
            Technical identifier for Nostr clients and developers
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            id="naddr"
            value={naddr}
            readOnly
            className="font-mono text-sm"
          />
          <CopyButton text={naddr} field="naddr" />
        </div>
      </div>

      {/* QR Code Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Code
          </CardTitle>
          <CardDescription>
            Scan this QR code to join the community
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <div className="p-3 bg-white rounded-lg border">
              {isGeneratingQR ? (
                <Skeleton className="w-64 h-64" />
              ) : qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt={`QR code for ${community.name}`}
                  className="w-64 h-64"
                />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center text-muted-foreground">
                  Failed to generate QR code
                </div>
              )}
            </div>
          </div>
          {qrCodeDataUrl && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadQRCode}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download QR Code
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
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
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${getRoleColor()}`}>
          {avatar ? (
            <img src={avatar} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            displayName.charAt(0).toUpperCase()
          )}
        </div>
        <div>
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
      <Button size="sm" variant="outline">Manage</Button>
    </div>
  );
}

// Helper component for displaying join requests
function JoinRequestItem({
  request,
  onApprove,
  onDecline,
  isApproving,
  isDeclining
}: {
  request: { requesterPubkey: string; message: string; createdAt: number };
  onApprove: () => void;
  onDecline: () => void;
  isApproving: boolean;
  isDeclining: boolean;
}) {
  const author = useAuthor(request.requesterPubkey);
  const displayName = author.data?.metadata?.name || genUserName(request.requesterPubkey);
  const avatar = author.data?.metadata?.picture;

  const timeAgo = new Date(request.createdAt * 1000).toLocaleString();

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
          {avatar ? (
            <img src={avatar} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            displayName.charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <p className="font-medium">{displayName}</p>
          <p className="text-sm text-muted-foreground">Requested {timeAgo}</p>
          {request.message && (
            <p className="text-xs text-muted-foreground mt-1 italic">"{request.message}"</p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onApprove}
          disabled={isApproving || isDeclining}
        >
          {isApproving ? "Approving..." : "Accept"}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={onDecline}
          disabled={isApproving || isDeclining}
        >
          {isDeclining ? "Declining..." : "Decline"}
        </Button>
      </div>
    </div>
  );
}

// Helper component for displaying reports
function ReportItem({ report }: { report: { targetPubkey: string; reportType: string; reason: string; createdAt: number; targetEventId?: string } }) {
  const author = useAuthor(report.targetPubkey);
  const displayName = author.data?.metadata?.name || genUserName(report.targetPubkey);

  const timeAgo = new Date(report.createdAt * 1000).toLocaleString();

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <p className="font-medium">
            {report.targetEventId ? 'Content reported' : 'User reported'}: {displayName}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Type: {report.reportType} • {timeAgo}
        </p>
        {report.reason && (
          <p className="text-xs text-muted-foreground mt-1 italic">"{report.reason}"</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline">Review</Button>
        <Button size="sm" variant="destructive">
          {report.targetEventId ? 'Delete' : 'Ban User'}
        </Button>
      </div>
    </div>
  );
}

// Helper component for displaying moderation log items
function ModerationLogItem({ log }: { log: { action: string; moderatorPubkey: string; targetPubkey?: string; reason: string; createdAt: number } }) {
  const moderator = useAuthor(log.moderatorPubkey);
  const target = useAuthor(log.targetPubkey || '');

  const moderatorName = moderator.data?.metadata?.name || genUserName(log.moderatorPubkey);
  const targetName = log.targetPubkey ? (target.data?.metadata?.name || genUserName(log.targetPubkey)) : null;

  const timeAgo = new Date(log.createdAt * 1000).toLocaleString();

  const getActionIcon = () => {
    switch (log.action) {
      case 'ban':
      case 'mute':
        return <Shield className="w-4 h-4 mt-1 text-red-500" />;
      case 'delete':
        return <Trash2 className="w-4 h-4 mt-1 text-red-500" />;
      case 'approve':
        return <Shield className="w-4 h-4 mt-1 text-green-500" />;
      default:
        return <FileText className="w-4 h-4 mt-1 text-blue-500" />;
    }
  };

  const getActionDescription = () => {
    const actionText = log.action.charAt(0).toUpperCase() + log.action.slice(1);
    if (targetName) {
      return `${moderatorName} ${log.action}ned ${targetName}`;
    }
    return `${moderatorName} performed ${actionText}`;
  };

  return (
    <div className="flex items-start gap-3 p-3 border rounded-lg">
      {getActionIcon()}
      <div className="flex-1">
        <p className="text-sm font-medium">{getActionDescription()}</p>
        {log.reason && (
          <p className="text-xs text-muted-foreground">Reason: {log.reason}</p>
        )}
        <p className="text-xs text-muted-foreground">{timeAgo}</p>
      </div>
    </div>
  );
}