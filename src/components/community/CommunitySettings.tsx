import { useState, useRef, useEffect } from "react";
import { Settings, Upload, X, Share2, Trash2, Clock, Users, Shield, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useCommunities, type Community } from "@/hooks/useCommunities";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCommunityMembers } from "@/hooks/useCommunityMembers";
import { useJoinRequests } from "@/hooks/useJoinRequests";
import { useModerationLogs } from "@/hooks/useModerationLogs";
import { useReports } from "@/hooks/useReporting";
import { useAuthor } from "@/hooks/useAuthor";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useToast } from "@/hooks/useToast";
import { useManageMembers } from "@/hooks/useManageMembers";
import { useCommunitySettings, useUpdateCommunitySettings } from "@/hooks/useCommunitySettings";
import { genUserName } from "@/lib/genUserName";

import { nip19 } from 'nostr-tools';
import { Copy, Check, QrCode, Download, Crown, AlertTriangle } from 'lucide-react';
import QRCode from 'qrcode';

interface CommunitySettingsProps {
  communityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommunitySettings({ communityId, open, onOpenChange }: CommunitySettingsProps) {
  const { data: communities } = useCommunities();
  const { user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState("overview");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    image: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Community settings
  const { data: communitySettings } = useCommunitySettings(communityId);
  const { mutateAsync: updateSettings } = useUpdateCommunitySettings(communityId);

  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { mutateAsync: createEvent } = useNostrPublish();
  const { toast } = useToast();
  const { addMember, declineMember } = useManageMembers();
  const [approvingMembers, setApprovingMembers] = useState<Set<string>>(new Set());
  const [decliningMembers, setDecliningMembers] = useState<Set<string>>(new Set());

  // Real data hooks
  const { data: members } = useCommunityMembers(communityId);
  const { data: joinRequests } = useJoinRequests(communityId);
  const { data: moderationLogs } = useModerationLogs(communityId || '');
  const { data: reports } = useReports(communityId);

  const community = communities?.find(c => c.id === communityId);

  // Calculate analytics from real data
  const totalMembers = members?.length || 0;
  const pendingRequests = joinRequests?.length || 0;
  const totalReports = reports?.length || 0;

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

  // Handle require approval toggle
  const handleRequireApprovalChange = async (checked: boolean) => {
    try {
      await updateSettings({ requireApproval: checked });
      toast({
        title: "Success",
        description: `Approval requirement ${checked ? 'enabled' : 'disabled'} successfully!`,
      });
    } catch (error) {
      console.error("Failed to update approval setting:", error);
      toast({
        title: "Error",
        description: "Failed to update approval setting",
        variant: "destructive",
      });
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
      setApprovingMembers(prev => new Set([...prev, requesterPubkey]));
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
      setDecliningMembers(prev => new Set([...prev, requesterPubkey]));
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

  const handleDeleteCommunity = async () => {
    if (!user || !community) return;

    try {
      // Create a kind 5 deletion request event
      await createEvent({
        kind: 5,
        content: "Community deleted by owner",
        tags: [
          ["e", community.event.id], // Reference the community event to be deleted
          ["k", "34550"], // Specify the kind of the event being deleted
        ],
      });

      toast({
        title: "Success",
        description: "Community deletion request sent successfully!",
      });

      // Close the settings dialog
      onOpenChange(false);

    } catch (error) {
      console.error("Failed to delete community:", error);
      toast({
        title: "Error",
        description: "Failed to delete community",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-gradient-to-br from-gray-950 via-blue-950/30 to-gray-950 border-blue-900/30 backdrop-blur-xl shadow-2xl shadow-blue-900/10 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-600/20 to-blue-800/20 rounded-full border border-blue-700/30">
              <Settings className="w-5 h-5 text-blue-400" />
            </div>
            {community.name} Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-14 grid w-full grid-cols-3 bg-gray-900/50 border border-blue-900/20 p-1 backdrop-blur-sm rounded-full">
            <TabsTrigger value="overview" className="flex items-center gap-2 data-[state=active]:bg-blue-600/15 data-[state=active]:text-blue-300 data-[state=active]:border-blue-600/30 rounded-full">
              <div className="p-2 bg-blue-600/10 rounded-full border border-blue-700/20">
                <Settings className="w-4 h-4 text-blue-400" />
              </div>
              Overview
            </TabsTrigger>
            <TabsTrigger value="members" className="flex items-center gap-2 relative data-[state=active]:bg-blue-600/15 data-[state=active]:text-blue-300 data-[state=active]:border-blue-600/30 rounded-full">
              <div className="p-2 bg-blue-600/10 rounded-full border border-blue-700/20">
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              Members
              {pendingRequests > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-red-600/80 border-red-500/50 backdrop-blur-sm">
                  {pendingRequests}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2 data-[state=active]:bg-blue-600/15 data-[state=active]:text-blue-300 data-[state=active]:border-blue-600/30 rounded-full">
              <div className="p-2 bg-blue-600/10 rounded-full border border-blue-700/20">
                <FileText className="w-4 h-4 text-blue-400" />
              </div>
              Audit
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[60vh] mt-4">
            <TabsContent value="overview" className="space-y-4">
              {/* Community Overview */}
              <Card className="bg-gray-900/40 border-blue-900/20 backdrop-blur-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-600/15 to-blue-800/15 rounded-full border border-blue-700/25">
                      <Settings className="w-4 h-4 text-blue-400" />
                    </div>
                    Community Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-gradient-to-br from-blue-600/10 to-blue-800/10 rounded-2xl border border-blue-700/20 backdrop-blur-sm">
                      <div className="text-2xl font-bold text-blue-300">{totalMembers}</div>
                      <div className="text-sm text-blue-200/70">Total Members</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-amber-600/10 to-amber-800/10 rounded-2xl border border-amber-700/20 backdrop-blur-sm">
                      <div className="text-2xl font-bold text-amber-300">{pendingRequests}</div>
                      <div className="text-sm text-amber-200/70">Pending Requests</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-red-600/10 to-red-800/10 rounded-2xl border border-red-700/20 backdrop-blur-sm">
                      <div className="text-2xl font-bold text-red-300">{totalReports}</div>
                      <div className="text-sm text-red-200/70">Reports</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Community Information */}
              <Card className="bg-gray-900/40 border-blue-900/20 backdrop-blur-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-600/15 to-blue-800/15 rounded-full border border-blue-700/25">
                      <Settings className="w-4 h-4 text-blue-400" />
                    </div>
                    Community Information
                  </CardTitle>
                  <CardDescription className="text-blue-200/60">
                    Basic settings for your community
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Community Icon */}
                  <div className="space-y-2">
                    <Label className="text-blue-200/80">Community Icon</Label>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="w-16 h-16 ring-2 ring-blue-600/30 shadow-lg shadow-blue-600/10 rounded-full">
                          <AvatarImage src={imagePreview || formData.image || community.image} />
                          <AvatarFallback className="text-lg bg-gradient-to-br from-blue-600 to-blue-800 rounded-full">
                            {community.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading || !isAdmin}
                          className="flex items-center gap-2 border-blue-900/30 text-blue-200/80 hover:bg-blue-600/10 rounded-full"
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
                            className="flex items-center gap-2 border-blue-900/30 text-blue-200/80 hover:bg-blue-600/10 rounded-full"
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
                    <p className="text-xs text-blue-200/50">
                      Upload a square image (recommended: 256x256px, max 5MB). Only admins can change the community icon.
                    </p>
                  </div>

                  {/* Community Name */}
                  <div className="space-y-2">
                    <Label htmlFor="community-name" className="text-blue-200/80">Community Name</Label>
                    <Input
                      id="community-name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      disabled={!isAdmin}
                      className="bg-gray-900/60 border-blue-900/30 text-blue-100 placeholder-blue-200/30 focus:border-blue-600/50 rounded-full"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="community-description" className="text-blue-200/80">Description</Label>
                    <Textarea
                      id="community-description"
                      placeholder="Describe your community..."
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      disabled={!isAdmin}
                      rows={3}
                      className="bg-gray-900/60 border-blue-900/30 text-blue-100 placeholder-blue-200/30 focus:border-blue-600/50 rounded-2xl"
                    />
                  </div>

                  {/* Approval Setting */}
                  <div className="flex items-center justify-between p-4 bg-gradient-to-br from-blue-600/5 to-blue-800/5 rounded-2xl border border-blue-700/20 backdrop-blur-sm">
                    <div className="space-y-1">
                      <Label htmlFor="require-approval" className="text-blue-200/80">Require approval to join</Label>
                      <p className="text-sm text-blue-200/60">
                        When enabled, new members need approval to join
                      </p>
                    </div>
                    <Switch
                      id="require-approval"
                      checked={communitySettings?.requireApproval ?? true}
                      onCheckedChange={handleRequireApprovalChange}
                      disabled={!isAdmin}
                    />
                  </div>

                  {/* Save Button */}
                  {isAdmin && (
                    <div className="pt-4">
                      <Button
                        onClick={handleSaveChanges}
                        disabled={isUploading}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-xl shadow-blue-600/20 border border-blue-600/30 rounded-full"
                      >
                        {isUploading ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sharing Section */}
              <Card className="bg-gray-900/40 border-blue-900/20 backdrop-blur-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-600/15 to-blue-800/15 rounded-full border border-blue-700/25">
                      <Share2 className="w-4 h-4 text-blue-400" />
                    </div>
                    Share Community
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CommunityShareContent community={community} />
                </CardContent>
              </Card>

              {/* Danger Zone */}
              {isAdmin && (
                <Card className="bg-red-900/10 border-red-700/30 backdrop-blur-sm rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-red-400 flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-red-600/15 to-red-800/15 rounded-full border border-red-700/25">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      Danger Zone
                    </CardTitle>
                    <CardDescription className="text-red-300/80">
                      Irreversible actions for this community
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-xl shadow-red-600/20 border border-red-600/30 rounded-full">
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
                          <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={handleDeleteCommunity}
                          >
                            Delete Community
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="members" className="space-y-4">
              {/* Join Requests */}
              {pendingRequests > 0 && (
                <Card className="bg-gray-900/40 border-blue-900/20 backdrop-blur-sm rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-amber-600/15 to-amber-800/15 rounded-full border border-amber-700/25">
                        <Clock className="w-4 h-4 text-amber-400" />
                      </div>
                      Pending Join Requests ({pendingRequests})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {joinRequests?.map((request) => (
                        <JoinRequestItem
                          key={request.event.id}
                          request={request}
                          onApprove={() => handleApproveRequest(request.requesterPubkey)}
                          onDecline={() => handleDeclineRequest(request.requesterPubkey)}
                          isApproving={approvingMembers.has(request.requesterPubkey)}
                          isDeclining={decliningMembers.has(request.requesterPubkey)}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Member Management */}
              <Card className="bg-gray-900/40 border-blue-900/20 backdrop-blur-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-600/15 to-blue-800/15 rounded-full border border-blue-700/25">
                      <Users className="w-4 h-4 text-blue-400" />
                    </div>
                    Member Management
                  </CardTitle>
                  <CardDescription className="text-blue-200/60">
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
                      <div className="text-center py-6 text-blue-200/40">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No members found</p>
                      </div>
                    )}
                    {members && members.length > 10 && (
                      <Button variant="outline" className="w-full border-blue-900/30 text-blue-200/80 hover:bg-blue-600/10 rounded-full">
                        View All {members.length} Members
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="space-y-4">
              {/* Reports */}
              <Card className="bg-gray-900/40 border-blue-900/20 backdrop-blur-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-red-600/15 to-red-800/15 rounded-full border border-red-700/25">
                      <Shield className="w-4 h-4 text-red-400" />
                    </div>
                    Moderation Queue ({totalReports})
                  </CardTitle>
                  <CardDescription className="text-blue-200/60">
                    Review flagged content and user reports
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {reports && reports.length > 0 ? (
                      reports.slice(0, 5).map((report) => (
                        <ReportItem key={report.id} report={report} />
                      ))
                    ) : (
                      <div className="text-center py-6 text-blue-200/40">
                        <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No pending reports</p>
                      </div>
                    )}
                    {reports && reports.length > 5 && (
                      <Button variant="outline" className="w-full border-blue-900/30 text-blue-200/80 hover:bg-blue-600/10 rounded-full">
                        View All {reports.length} Reports
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Audit Log */}
              <Card className="bg-gray-900/40 border-blue-900/20 backdrop-blur-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-600/15 to-blue-800/15 rounded-full border border-blue-700/25">
                      <FileText className="w-4 h-4 text-blue-400" />
                    </div>
                    Audit Log
                  </CardTitle>
                  <CardDescription className="text-blue-200/60">
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
                      <div className="text-center py-6 text-blue-200/40">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No moderation actions recorded</p>
                      </div>
                    )}
                    {moderationLogs && moderationLogs.length > 10 && (
                      <Button variant="outline" className="w-full border-blue-900/30 text-blue-200/80 hover:bg-blue-600/10 rounded-full">
                        View All {moderationLogs.length} Actions
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>

          <div className="flex justify-end pt-4 border-t border-blue-900/20">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-blue-900/30 text-blue-200/80 hover:bg-blue-600/10 rounded-full"
            >
              Close
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Helper component for displaying reports
function ReportItem({ report }: { report: { targetPubkey: string; reporterPubkey: string; reportType: string; reason: string; createdAt: number; targetEventId?: string } }) {
  const targetAuthor = useAuthor(report.targetPubkey);
  const reporterAuthor = useAuthor(report.reporterPubkey);
  const targetDisplayName = targetAuthor.data?.metadata?.name || genUserName(report.targetPubkey);
  const reporterDisplayName = reporterAuthor.data?.metadata?.name || genUserName(report.reporterPubkey);

  const targetNpub = nip19.npubEncode(report.targetPubkey);
  const reporterNpub = nip19.npubEncode(report.reporterPubkey);

  const { toast } = useToast();

  const handleCopyNpub = (npub: string, userType: string) => {
    navigator.clipboard.writeText(npub);
    toast({
      title: 'Copied to clipboard',
      description: `${userType} npub copied to clipboard`,
    });
  };

  const timeAgo = new Date(report.createdAt * 1000).toLocaleString();

  return (
    <div className="p-3 border rounded-2xl bg-gray-900/60 border-blue-900/20 backdrop-blur-sm">
      <div className="space-y-3">
        {/* Reported User */}
        <div className="space-y-1">
          <div className="font-medium flex items-center gap-2 text-blue-100">
            <span className="text-red-400">Reported User:</span>
            {targetDisplayName}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-blue-200/60 hover:text-blue-100 rounded-full"
              onClick={() => handleCopyNpub(targetNpub, 'Target user')}
              title="Copy target user npub"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <div className="text-xs text-blue-200/50 font-mono break-all">
            {targetNpub}
          </div>
        </div>

        {/* Reporting User */}
        <div className="space-y-1">
          <div className="text-sm text-blue-200/60 flex items-center gap-2">
            <span className="text-blue-400">Reported by:</span>
            {reporterDisplayName}
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-blue-200/60 hover:text-blue-100 rounded-full"
              onClick={() => handleCopyNpub(reporterNpub, 'Reporter')}
              title="Copy reporter npub"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <div className="text-xs text-blue-200/50 font-mono break-all">
            {reporterNpub}
          </div>
        </div>

        {/* Report Details */}
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-400" />
          <p className="text-sm font-medium text-blue-100">
            {report.targetEventId ? 'Content reported' : 'User reported'}
          </p>
          <Badge variant="outline" className="text-xs border-blue-900/30 text-blue-200/80 bg-gray-900/60 rounded-full">
            {report.reportType}
          </Badge>
        </div>

        <p className="text-xs text-blue-200/50">
          {timeAgo}
        </p>

        {report.reason && (
          <p className="text-xs text-blue-200/50 italic">"{report.reason}"</p>
        )}
      </div>

      <div className="flex gap-2 mt-3">
        <Button size="sm" variant="destructive" className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg shadow-red-600/20 border border-red-600/30 rounded-full">
          {report.targetEventId ? 'Delete Content' : 'Ban User'}
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
        return <Shield className="w-4 h-4 mt-1 text-red-400" />;
      case 'delete':
        return <Trash2 className="w-4 h-4 mt-1 text-red-400" />;
      case 'approve':
        return <Shield className="w-4 h-4 mt-1 text-green-400" />;
      default:
        return <FileText className="w-4 h-4 mt-1 text-blue-400" />;
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
    <div className="flex items-start gap-3 p-3 border rounded-2xl bg-gray-900/60 border-blue-900/20 backdrop-blur-sm">
      <div className="p-2 bg-gradient-to-br from-blue-600/10 to-blue-800/10 rounded-full border border-blue-700/20">
        {getActionIcon()}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-blue-100">{getActionDescription()}</p>
        {log.reason && (
          <p className="text-xs text-blue-200/60">Reason: {log.reason}</p>
        )}
        <p className="text-xs text-blue-200/50">{timeAgo}</p>
      </div>
    </div>
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

  // Generate naddr for the community with error handling
  let naddr = '';
  try {
    // Pad the pubkey to 64 characters (32 bytes) if needed
    const paddedPubkey = pubkey.padStart(64, '0');

    naddr = nip19.naddrEncode({
      kind: parseInt(kind),
      pubkey: paddedPubkey,
      identifier,
      relays: community.relays.length > 0 ? community.relays : undefined,
    });
  } catch (error) {
    console.error('Failed to generate naddr:', error);
    // Fallback to a simple join URL without naddr
  }

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
      className={`${className} border-gray-600 text-gray-300 hover:bg-gray-700`}
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
          <Label className="text-gray-200">Join Link</Label>
          <p className="text-sm text-gray-400 mb-2">
            Direct link for people to request to join your community
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={joinUrl}
            readOnly
            className="font-mono text-sm bg-gray-700 border-gray-600 text-gray-100"
          />
          <CopyButton text={joinUrl} field="join-url" />
        </div>
      </div>

      {/* Nostr Address */}
      <div className="space-y-3">
        <div>
          <Label className="text-gray-200">Nostr Address (naddr)</Label>
          <p className="text-sm text-gray-400 mb-2">
            Technical identifier for Nostr clients and developers
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={naddr}
            readOnly
            className="font-mono text-sm bg-gray-700 border-gray-600 text-gray-100"
          />
          <CopyButton text={naddr} field="naddr" />
        </div>
      </div>

      {/* QR Code Section */}
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-medium text-white mb-2 flex items-center justify-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Code
          </h3>
          <p className="text-sm text-gray-400">
            Scan this QR code to join the community
          </p>
        </div>
        <div className="flex justify-center">
          <div className="p-3 bg-white rounded-lg border border-gray-600">
            {isGeneratingQR ? (
              <div className="w-64 h-64 bg-gray-200 animate-pulse rounded" />
            ) : qrCodeDataUrl ? (
              <img
                src={qrCodeDataUrl}
                alt={`QR code for ${community.name}`}
                className="w-64 h-64"
              />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center text-gray-500">
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
              className="flex items-center gap-2 border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <Download className="h-4 w-4" />
              Download QR Code
            </Button>
          </div>
        )}
      </div>
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
    <div className="flex items-center justify-between p-3 bg-gray-900/60 border border-blue-900/20 rounded-2xl backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center text-white text-sm font-medium ring-2 ring-blue-600/30 shadow-lg shadow-blue-600/10">
            {avatar ? (
              <img src={avatar} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>
        </div>
        <div>
          <p className="font-medium text-blue-100">{displayName}</p>
          <p className="text-sm text-blue-200/60">Requested {timeAgo}</p>
          {request.message && (
            <p className="text-xs text-blue-200/50 mt-1 italic">"{request.message}"</p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onApprove}
          disabled={isApproving || isDeclining}
          className="border-green-600/30 text-green-300/80 hover:bg-green-600/10 bg-green-600/5 rounded-full"
        >
          {isApproving ? "Approving..." : "Accept"}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={onDecline}
          disabled={isApproving || isDeclining}
          className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg shadow-red-600/20 border border-red-600/30 rounded-full"
        >
          {isDeclining ? "Declining..." : "Decline"}
        </Button>
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
        return <Crown className="w-3 h-3 text-amber-300" />;
      case 'moderator':
        return <Shield className="w-3 h-3 text-blue-300" />;
      default:
        return null;
    }
  };

  const getRoleColor = () => {
    switch (member.role) {
      case 'owner':
        return 'from-amber-600 to-amber-800 ring-amber-600/30 shadow-lg shadow-amber-600/10';
      case 'moderator':
        return 'from-blue-600 to-blue-800 ring-blue-600/30 shadow-lg shadow-blue-600/10';
      default:
        return 'from-gray-600 to-gray-800 ring-gray-600/30 shadow-lg shadow-gray-600/10';
    }
  };

  return (
    <div className="flex items-center justify-between p-3 border rounded-2xl bg-gray-900/60 border-blue-900/20 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className={`w-8 h-8 bg-gradient-to-br ${getRoleColor()} rounded-full flex items-center justify-center text-white text-sm font-medium ring-2`}>
            {avatar ? (
              <img src={avatar} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-blue-100">{displayName}</p>
            {member.isOnline && (
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/30" title="Online" />
            )}
          </div>
          <div className="flex gap-1">
            <Badge variant={member.role === 'owner' ? 'secondary' : 'outline'} className="flex items-center gap-1 bg-gray-900/60 border-blue-900/20 text-blue-200/80 rounded-full">
              {getRoleIcon()}
              {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
            </Badge>
          </div>
        </div>
      </div>
      <Button size="sm" variant="outline" className="border-blue-900/30 text-blue-200/80 hover:bg-blue-600/10 rounded-full">Manage</Button>
    </div>
  );
}



