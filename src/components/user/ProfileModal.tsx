import { useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContentNoClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserStatusIndicator } from "@/components/user/UserStatusIndicator";
import { UserStatusDialog } from "@/components/user/UserStatusDialog";
import { EditProfileDialog } from "@/components/EditProfileDialog";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";
import { getTraditionalStatusText, useUserStatus, useUserMusicStatus } from "@/hooks/useUserStatus";

import { useCommunities } from "@/hooks/useCommunities";
import { useIsFriend } from "@/hooks/useFriends";
import { useManageFriends } from "@/hooks/useManageFriends";
import { useManageMutedUsers } from "@/hooks/useManageMutedUsers";
import { useIsMuted } from "@/hooks/useMutedUsers";
import { genUserName } from "@/lib/genUserName";
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import {
  Edit,
  Settings,
  X,
  Globe,
  Check,
  Copy,
  Users,
  Building,
  Activity,
  FileText,
  Image,
  MessageCircle,
  UserPlus,
  MoreHorizontal,
  Flag,
  VolumeX,
  Music,
  Zap
} from "lucide-react";
import { nip19 } from "nostr-tools";
import { toast } from "sonner";

// Helper function to create njump URL for events
const createNjumpUrl = (event: NostrEvent): string => {
  const nevent = nip19.neventEncode({
    id: event.id,
    author: event.pubkey,
    kind: event.kind,
  });
  return `https://njump.me/${nevent}`;
};
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ZapDialog } from "@/components/ZapDialog";
import { ReportUserDialog } from "@/components/reporting/ReportUserDialog";
import type { NostrEvent } from '@nostrify/nostrify';

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
  targetPubkey?: string; // If provided, shows another user's profile with mutual connections
  onNavigateToDMs?: (targetPubkey?: string) => void; // Function to navigate to DMs
  onProfileChange?: (newPubkey: string) => void; // Function to change to a different profile
}

export function ProfileModal({
  open,
  onOpenChange,
  onOpenSettings,
  targetPubkey,
  onNavigateToDMs,
  onProfileChange
}: ProfileModalProps) {
  const { user } = useCurrentUser();
  const isOwnProfile = !targetPubkey || targetPubkey === user?.pubkey;
  const profilePubkey = targetPubkey || user?.pubkey || '';

  const author = useAuthor(profilePubkey);
  const metadata = author.data?.metadata;
  const { data: userStatus } = useUserStatus(profilePubkey);
  const { data: musicStatus } = useUserMusicStatus(profilePubkey);

  // Follow state and actions
  const isFollowing = useIsFriend(profilePubkey);
  const { addFriend, removeFriend, isAddingFriend, isRemovingFriend } = useManageFriends();

  // Mute state and actions (NIP-51 compliant)
  const isMuted = useIsMuted(profilePubkey);
  const { muteUser, unmuteUser, isMuting, isUnmuting } = useManageMutedUsers();

  // Dialog states
  const [showReportDialog, setShowReportDialog] = useState(false);

  const [copied, setCopied] = useState(false);
  const [showEditProfileDialog, setShowEditProfileDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'contacts' | 'spaces' | 'activity'>('activity');


  // Hook for fetching following lists (NIP-02)
  const { nostr } = useNostr();

  // Fetch current user's contacts (kind 3)
  const { data: currentUserContacts } = useQuery({
    queryKey: ['contacts', user?.pubkey],
    queryFn: async (_c) => {
      if (!user?.pubkey) return [];
      const signal = AbortSignal.any([_c.signal, AbortSignal.timeout(3000)]);
      const events = await nostr.query([{
        kinds: [3],
        authors: [user.pubkey],
        limit: 1
      }], { signal });

      const latestContactEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
      if (!latestContactEvent) return [];

      return latestContactEvent.tags
        .filter(([name]) => name === 'p')
        .map(([, pubkey]) => pubkey)
        .filter(Boolean);
    },
    enabled: !!user?.pubkey && open,
  });

  // Fetch target user's contacts (kind 3) - only if viewing another user
  const { data: targetUserContacts } = useQuery({
    queryKey: ['contacts', profilePubkey],
    queryFn: async (_c) => {
      if (!profilePubkey || isOwnProfile) return [];
      const signal = AbortSignal.any([_c.signal, AbortSignal.timeout(3000)]);
      const events = await nostr.query([{
        kinds: [3],
        authors: [profilePubkey],
        limit: 1
      }], { signal });

      const latestContactEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
      if (!latestContactEvent) return [];

      return latestContactEvent.tags
        .filter(([name]) => name === 'p')
        .map(([, pubkey]) => pubkey)
        .filter(Boolean);
    },
    enabled: !isOwnProfile && !!profilePubkey && open,
  });

  // Get mutual contacts
  const mutualContacts = useMemo(() => {
    if (isOwnProfile || !currentUserContacts || !targetUserContacts) return [];
    return currentUserContacts.filter(pubkey => targetUserContacts.includes(pubkey));
  }, [currentUserContacts, targetUserContacts, isOwnProfile]);

  // Get communities and mutual spaces
  const { data: communities } = useCommunities();

  // Function to check if a user is a member of a community
  const isUserMemberOfCommunity = useCallback(async (userPubkey: string, communityId: string): Promise<boolean> => {
    if (!nostr) return false;

    // First check if user is owner or moderator from community definition
    const community = communities?.find(c => c.id === communityId);
    if (community) {
      if (community.creator === userPubkey || community.moderators.includes(userPubkey)) {
        return true;
      }
    }

    // Check if user is in the approved members list
    try {
      const membershipEvents = await nostr.query([
        {
          kinds: [34551], // Approved members list
          '#d': [communityId],
          '#p': [userPubkey],
          limit: 1,
        }
      ]);

      return membershipEvents.length > 0;
    } catch {
      return false;
    }
  }, [communities, nostr]);

  // Get user's community memberships (including approved members)
  const userCommunities = useQuery({
    queryKey: ['user-communities', user?.pubkey, communities],
    queryFn: async (_c) => {
      if (!user?.pubkey || !communities) return [];

      const userCommunityList: typeof communities = [];

      for (const community of communities) {
        if (await isUserMemberOfCommunity(user.pubkey, community.id)) {
          userCommunityList.push(community);
        }
      }

      return userCommunityList;
    },
    enabled: !!user?.pubkey && !!communities,
  });

  // Get target user's community memberships (including approved members)
  const targetCommunities = useQuery({
    queryKey: ['target-communities', profilePubkey, communities, isOwnProfile],
    queryFn: async (_c) => {
      if (isOwnProfile || !profilePubkey || !communities) return userCommunities.data || [];

      const targetCommunityList: typeof communities = [];

      for (const community of communities) {
        if (await isUserMemberOfCommunity(profilePubkey, community.id)) {
          targetCommunityList.push(community);
        }
      }

      return targetCommunityList;
    },
    enabled: !!profilePubkey && !!communities && !isOwnProfile,
  });

  // Get mutual spaces
  const mutualSpaces = useMemo(() => {
    if (isOwnProfile || !userCommunities.data || !targetCommunities.data) return [];

    return userCommunities.data.filter(userCommunity =>
      targetCommunities.data.some(targetCommunity => targetCommunity.id === userCommunity.id)
    );
  }, [userCommunities.data, targetCommunities.data, isOwnProfile]);

  // Fetch user activity (notes, images, articles)
  const { data: userActivity } = useQuery({
    queryKey: ['user-activity', profilePubkey],
    queryFn: async (c) => {
      if (!profilePubkey) return { notes: [], images: [], articles: [] };
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Fetch different kinds of content separately to ensure we get enough of each
      const [noteEvents, imageEvents, articleEvents] = await Promise.all([
        nostr.query([{
          kinds: [1], // notes
          authors: [profilePubkey],
          limit: 20 // Get more notes to filter replies
        }], { signal }),
        nostr.query([{
          kinds: [20], // images
          authors: [profilePubkey],
          limit: 10 // Get recent images
        }], { signal }),
        nostr.query([{
          kinds: [30023], // articles
          authors: [profilePubkey],
          limit: 10 // Get recent articles
        }], { signal })
      ]);

      // Filter notes to get root notes only
      const notes = noteEvents
        .filter(e => {
          // Check for any "e" tags (these indicate replies)
          const eTags = e.tags.filter(([name]) => name === 'e');
          const hasETags = eTags.length > 0;

          // Only show notes without "e" tags (root notes)
          return !hasETags;
        })
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, 6);

      // Images are already filtered by kind, just sort and limit
      const images = imageEvents
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, 6);

      // Articles are already filtered by kind, just sort and limit
      const articles = articleEvents
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, 6);

      return { notes, images, articles };
    },
    enabled: !!profilePubkey && open,
  });

  if (!user || !profilePubkey) return null;

  const displayName = metadata?.name || genUserName(profilePubkey);
  const profileImage = metadata?.picture;
  const banner = metadata?.banner;
  const about = metadata?.about;
  const website = metadata?.website;
  const nip05 = metadata?.nip05;
  const npub = nip19.npubEncode(profilePubkey);

  const handleEditProfile = () => {
    setShowEditProfileDialog(true);
  };

  const handleCopyNpub = async () => {
    try {
      await navigator.clipboard.writeText(npub);
      setCopied(true);
      toast.success("Copied npub to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy npub");
    }
  };

  const handleToggleFollow = async () => {
    try {
      if (isFollowing) {
        await removeFriend(profilePubkey);
      } else {
        // Get user's preferred relay from their profile metadata
        const userRelay = metadata?.nip05 ? `wss://${metadata.nip05.split('@')[1]}` : undefined;
        await addFriend({
          pubkey: profilePubkey,
          relay: userRelay,
          petname: displayName
        });
      }
    } catch (error) {
      // Error handling is already done in the useManageFriends hook
      console.error('Follow/unfollow error:', error);
    }
  };

  const handleStartDM = () => {
    // Navigate to DMs and start conversation with this user
    onNavigateToDMs?.(profilePubkey);
    onOpenChange(false); // Close the profile modal
  };

  const handleToggleMute = async () => {
    try {
      if (isMuted) {
        await unmuteUser(profilePubkey);
      } else {
        await muteUser(profilePubkey);
      }
    } catch (error) {
      // Error handling is already done in the useManageMutedUsers hook
      console.error('Mute/unmute error:', error);
    }
  };

  const handleReport = () => {
    setShowReportDialog(true);
  };

  // Create a minimal event object for the ZapDialog
  const fakeEvent = {
    id: `fake-${profilePubkey}`,
    pubkey: profilePubkey,
    kind: 0,
    content: '',
    tags: [],
    created_at: Math.floor(Date.now() / 1000),
    sig: ''
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContentNoClose className="max-w-5xl w-[98vw] sm:w-[95vw] md:w-[90vw] lg:w-full p-0 bg-gray-900 border-gray-700 sm:mt-[5vh]">
          <div className="flex flex-col sm:flex-row h-[95vh] sm:h-[85vh] max-h-none min-h-[600px] sm:min-h-[500px]">
            {/* Left Pane - Discord Style Profile */}
            <div className="w-full sm:w-80 h-[45vh] sm:h-auto bg-gray-800 rounded-t-lg sm:rounded-l-lg sm:rounded-tr-none flex flex-col relative overflow-hidden flex-shrink-0 sm:flex-shrink">
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 sm:top-3 sm:right-3 w-8 h-8 bg-black/30 hover:bg-black/50 text-white z-30 rounded-full"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-4 h-4" />
              </Button>

              {/* Large Banner with Avatar */}
              <div className="h-24 sm:h-32 bg-gradient-to-br from-purple-600 to-pink-600 relative">
                {banner && (
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${banner})` }}
                  />
                )}

                {/* Large Avatar positioned at bottom of banner */}
                <div className="absolute bottom-0 left-3 sm:left-4 transform translate-y-1/2">
                  <Avatar className="w-16 h-16 sm:w-20 sm:h-20 border-4 sm:border-6 border-gray-800">
                    <AvatarImage src={profileImage} alt={displayName} />
                    <AvatarFallback className="bg-indigo-600 text-white text-lg sm:text-xl font-bold">
                      {displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {/* Online status indicator */}
                  <div className="absolute bottom-0 sm:bottom-1 right-0 sm:right-1 w-4 h-4 sm:w-6 sm:h-6 bg-green-500 rounded-full border-2 sm:border-4 border-gray-800"></div>
                </div>
              </div>

              <div className="px-3 pb-3 pt-8 sm:pt-10 overflow-y-auto flex-1">

                {/* Profile content */}
                <div className="flex flex-col items-center text-center">
                    {/* Profile Info */}
                    <div className="space-y-2 w-full">
                      <div>
                        <div className="flex items-center justify-center space-x-2">
                          <h2 className="text-base sm:text-lg lg:text-xl font-bold text-white">{displayName}</h2>
                          {isOwnProfile && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                onOpenSettings();
                                onOpenChange(false);
                              }}
                              className="h-6 w-6 hover:bg-gray-700 text-gray-400 hover:text-white"
                              title="Settings"
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        {/* Status message */}
                        {(userStatus?.emoji || userStatus?.message) && (
                          <div className="flex items-center justify-center space-x-1 mt-1">
                            <span className="text-xs sm:text-sm">🌌</span>
                            {userStatus.emoji && (
                              <span className="text-xs sm:text-sm">{userStatus.emoji}</span>
                            )}
                            {userStatus.message && (
                              <p className="text-xs sm:text-sm text-gray-300 truncate max-w-[200px] sm:max-w-none">{userStatus.message}</p>
                            )}
                          </div>
                        )}

                        {/* Music Status */}
                        {musicStatus && musicStatus.content && (
                          <div className="flex items-center justify-center space-x-1 mt-1">
                            <Music className="w-3 h-3 text-purple-500" />
                            <p className="text-xs sm:text-sm text-gray-300 truncate max-w-[200px] sm:max-w-none">
                              {musicStatus.link ? (
                                <a
                                  href={musicStatus.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-purple-400 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {musicStatus.content}
                                </a>
                              ) : (
                                musicStatus.content
                              )}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center justify-center space-x-1 mt-1">
                          <p className="text-gray-400 text-xs sm:text-sm">@{npub.slice(0, 12)}...</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCopyNpub}
                            className="h-5 w-5 hover:bg-gray-700"
                            title="Copy npub"
                          >
                            {copied ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3 text-gray-400" />
                            )}
                          </Button>
                        </div>
                        {isOwnProfile && (
                          <div className="flex justify-center w-100 mt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowStatusDialog(true)}
                              className="flex items-center space-x-1 border-gray-600 text-gray-300 hover:bg-gray-700 h-7 px-2 text-xs"
                            >
                              <UserStatusIndicator pubkey={profilePubkey} />
                              <span>
                                {userStatus?.emoji ? 'Custom Status' : (getTraditionalStatusText(userStatus?.status) || 'Set Status')}
                              </span>
                            </Button>
                          </div>
                        )}
                        {nip05 && (
                          <Badge variant="secondary" className="mt-2 text-xs bg-green-900/30 text-green-400 border-green-700 max-w-[200px] sm:max-w-none truncate">
                            ✓ {nip05}
                          </Badge>
                        )}
                      </div>

                      {about && (
                        <p className="text-gray-300 text-xs sm:text-sm leading-relaxed px-2 lg:px-0">{about}</p>
                      )}

                      {/* Metadata */}
                      <div className="space-y-1 text-xs text-gray-400">
                        {website && (
                          <div className="flex items-center justify-center space-x-1">
                            <Globe className="w-3 h-3" />
                            <a
                              href={website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-400 hover:underline"
                            >
                              {website.replace(/^https?:\/\//, '')}
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      {isOwnProfile ? (
                        <div className="flex items-center justify-center space-x-2 pt-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={handleEditProfile}
                            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 h-8 px-3"
                          >
                            <Edit className="w-4 h-4" />
                            <span>Edit Profile</span>
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1 pt-1">
                          {/* Follow button */}
                          <Button
                            variant={isFollowing ? "outline" : "default"}
                            size="sm"
                            onClick={handleToggleFollow}
                            disabled={isAddingFriend || isRemovingFriend}
                            className={`flex-1 h-8 text-xs ${
                              isFollowing
                                ? "border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                                : "bg-indigo-600 hover:bg-indigo-700 text-white"
                            }`}
                          >
                            <UserPlus className="w-3 h-3 mr-1" />
                            {isAddingFriend || isRemovingFriend
                              ? "..."
                              : isFollowing
                                ? "Following"
                                : "Follow"
                            }
                          </Button>

                          {/* DM button */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleStartDM}
                            className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white h-8 text-xs"
                          >
                            <MessageCircle className="w-3 h-3 mr-1" />
                            Message
                          </Button>

                          {/* Zap button */}
                          <ZapDialog target={fakeEvent}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-8 h-8 p-0 border-yellow-600 text-yellow-500 hover:bg-yellow-500/20 hover:border-yellow-500"
                              title="Send zap"
                            >
                              <Zap className="w-3 h-3" />
                            </Button>
                          </ZapDialog>

                          {/* More actions dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-8 h-8 p-0 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                              >
                                <MoreHorizontal className="w-3 h-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="bg-gray-800 border-gray-600"
                            >
                              <DropdownMenuItem
                                onClick={handleToggleMute}
                                disabled={isMuting || isUnmuting}
                                className="text-orange-400 focus:text-orange-300 focus:bg-orange-900/20"
                              >
                                <VolumeX className="w-4 h-4 mr-2" />
                                {isMuting || isUnmuting ? "..." : isMuted ? "Unmute User" : "Mute User"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-gray-600" />
                              <DropdownMenuItem
                                onClick={handleReport}
                                className="text-red-400 focus:text-red-300 focus:bg-red-900/20"
                              >
                                <Flag className="w-4 h-4 mr-2" />
                                Report User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            {/* Right Pane - Discord Style Activity */}
            <div className="flex-1 bg-gray-800/80 rounded-b-lg sm:rounded-r-lg sm:rounded-bl-none flex flex-col overflow-hidden">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'contacts' | 'spaces' | 'activity')} className="flex flex-col h-full">
                  {isOwnProfile ? (
                    /* Own profile - Activity only */
                    <div className="mx-2 sm:mx-3 mt-2 sm:mt-3 mb-0 flex-shrink-0">
                      <div className="bg-gray-700 rounded-lg p-2 text-center">
                        <div className="flex items-center justify-center gap-1 text-sm px-3 py-2 font-medium text-white">
                          <Activity className="w-4 h-4" />
                          <span>My Activity</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Other profiles - All tabs */
                    <TabsList className="grid w-full grid-cols-3 bg-gray-700 mx-2 sm:mx-3 mt-2 sm:mt-3 mb-0 flex-shrink-0 rounded-lg">
                      <TabsTrigger value="activity" className="flex items-center gap-1 text-sm px-3 py-2 font-medium">
                        <Activity className="w-4 h-4" />
                        <span>Activity</span>
                      </TabsTrigger>
                      <TabsTrigger value="contacts" className="flex items-center gap-1 text-sm px-3 py-2 font-medium">
                        <Users className="w-4 h-4" />
                        <span>Contacts</span>
                      </TabsTrigger>
                      <TabsTrigger value="spaces" className="flex items-center gap-1 text-sm px-3 py-2 font-medium">
                        <Building className="w-4 h-4" />
                        <span>Spaces</span>
                      </TabsTrigger>
                    </TabsList>
                  )}

                  {isOwnProfile ? (
                    /* Own profile - Direct activity content without TabsContent */
                    <div className="flex-1 min-h-0 mx-2 sm:mx-3 mt-1 sm:mt-2 mb-2 sm:mb-3">
                      <div className="h-full overflow-y-auto scrollbar-thin p-2 sm:p-4 space-y-3 sm:space-y-4 bg-gray-900/30 rounded-lg border border-gray-700/50">

                        {/* Notes Section */}
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-gray-400 border-b border-gray-600 pb-1">
                          <MessageCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Notes</span>
                        </div>
                        {userActivity?.notes && userActivity.notes.length > 0 ? (
                          userActivity.notes.map((note) => (
                            <ActivityNoteItem key={note.id} event={note} />
                          ))
                        ) : (
                          <p className="text-xs text-gray-500 pl-6">No recent notes</p>
                        )}
                      </div>

                      {/* Images Section - Gallery Style */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2 text-gray-400 border-b border-gray-600 pb-1">
                          <Image className="w-4 h-4" />
                          <span className="text-sm font-medium">Photos</span>
                        </div>
                        {userActivity?.images && userActivity.images.length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                            {userActivity.images.map((image) => (
                              <ActivityImageGalleryItem key={image.id} event={image} />
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 pl-6">No recent photos</p>
                        )}
                      </div>

                      {/* Articles Section */}
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-gray-400 border-b border-gray-600 pb-1">
                          <FileText className="w-4 h-4" />
                          <span className="text-sm font-medium">Articles</span>
                        </div>
                        {userActivity?.articles && userActivity.articles.length > 0 ? (
                          userActivity.articles.map((article) => (
                            <ActivityArticleItem key={article.id} event={article} />
                          ))
                        ) : (
                          <p className="text-xs text-gray-500 pl-6">No recent articles</p>
                        )}
                      </div>
                      </div>
                    </div>
                  ) : (
                    /* Other profiles - Wrapped in TabsContent */
                    <TabsContent value="activity" className="flex-1 min-h-0 mx-2 sm:mx-3 mt-1 sm:mt-2 mb-2 sm:mb-3">
                      <div className="h-full overflow-y-auto scrollbar-thin p-2 sm:p-4 space-y-3 sm:space-y-4 bg-gray-900/30 rounded-lg border border-gray-700/50">

                        {/* Notes Section */}
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2 text-gray-400 border-b border-gray-600 pb-1">
                            <MessageCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Notes</span>
                          </div>
                          {userActivity?.notes && userActivity.notes.length > 0 ? (
                            userActivity.notes.map((note) => (
                              <ActivityNoteItem key={note.id} event={note} />
                            ))
                          ) : (
                            <p className="text-xs text-gray-500 pl-6">No recent notes</p>
                          )}
                        </div>

                        {/* Images Section - Gallery Style */}
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2 text-gray-400 border-b border-gray-600 pb-1">
                            <Image className="w-4 h-4" />
                            <span className="text-sm font-medium">Photos</span>
                          </div>
                          {userActivity?.images && userActivity.images.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                              {userActivity.images.map((image) => (
                                <ActivityImageGalleryItem key={image.id} event={image} />
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500 pl-6">No recent photos</p>
                          )}
                        </div>

                        {/* Articles Section */}
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2 text-gray-400 border-b border-gray-600 pb-1">
                            <FileText className="w-4 h-4" />
                            <span className="text-sm font-medium">Articles</span>
                          </div>
                          {userActivity?.articles && userActivity.articles.length > 0 ? (
                            userActivity.articles.map((article) => (
                              <ActivityArticleItem key={article.id} event={article} />
                            ))
                          ) : (
                            <p className="text-xs text-gray-500 pl-6">No recent articles</p>
                          )}
                        </div>
                      </div>
                    </TabsContent>
                  )}

                  {!isOwnProfile && (
                    <>
                      <TabsContent value="contacts" className="flex-1 min-h-0 mx-2 sm:mx-3 mt-1 sm:mt-2 mb-2 sm:mb-3">
                        <div className="h-full overflow-y-auto scrollbar-thin p-2 sm:p-4 space-y-3 bg-gray-900/30 rounded-lg border border-gray-700/50">
                          <div>
                            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
                              <Users className="w-4 h-4 mr-2" />
                              Mutual Contacts ({mutualContacts.length})
                            </h3>
                            {mutualContacts.length > 0 ? (
                              <div className="space-y-2">
                                {mutualContacts.map((contactPubkey) => (
                                  <MutualContactItem
                                    key={contactPubkey}
                                    pubkey={contactPubkey}
                                    onProfileClick={(pubkey) => {
                                      onProfileChange?.(pubkey);
                                    }}
                                  />
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-12">
                                <Users className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                                <p className="text-gray-500 text-sm">No mutual contacts</p>
                                <p className="text-gray-600 text-xs mt-1">People you both follow will appear here</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="spaces" className="flex-1 min-h-0 mx-2 sm:mx-3 mt-1 sm:mt-2 mb-2 sm:mb-3">
                    <div className="h-full overflow-y-auto scrollbar-thin p-2 sm:p-4 space-y-3 bg-gray-900/30 rounded-lg border border-gray-700/50">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
                          <Building className="w-4 h-4 mr-2" />
                          Mutual Spaces ({mutualSpaces.length})
                        </h3>
                        {mutualSpaces.length > 0 ? (
                          <div className="space-y-2">
                            {mutualSpaces.map((community) => (
                              <MutualSpaceItem key={community.id} community={community} />
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <Building className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                            <p className="text-gray-500 text-sm">No mutual spaces</p>
                            <p className="text-gray-600 text-xs mt-1">Communities you both belong to will appear here</p>
                          </div>
                        )}
                      </div>
                        </div>
                      </TabsContent>
                    </>
                  )}
                </Tabs>
              </div>
          </div>
        </DialogContentNoClose>
      </Dialog>

      {/* Status Dialog */}
      <UserStatusDialog
        open={showStatusDialog}
        onOpenChange={setShowStatusDialog}
      />

      {/* Edit Profile Dialog */}
      <EditProfileDialog
        open={showEditProfileDialog}
        onOpenChange={setShowEditProfileDialog}
      />

      {/* Report Dialog */}
      <ReportUserDialog
        targetPubkey={profilePubkey}
        targetDisplayName={displayName}
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
      />

      </>
  );
}

// Component for displaying a mutual contact
interface MutualContactItemProps {
  pubkey: string;
  onProfileClick: (pubkey: string) => void;
}

function MutualContactItem({ pubkey, onProfileClick }: MutualContactItemProps) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || genUserName(pubkey);
  const profileImage = metadata?.picture;

  return (
    <div
      className="flex items-center space-x-3 p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700/70 transition-colors cursor-pointer"
      onClick={() => onProfileClick(pubkey)}
    >
      <Avatar className="w-8 h-8">
        <AvatarImage src={profileImage} alt={displayName} />
        <AvatarFallback className="bg-indigo-600 text-white text-xs">
          {displayName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate hover:text-indigo-400 transition-colors">{displayName}</p>
      </div>
    </div>
  );
}



// Component for displaying a mutual space/community
interface MutualSpaceItemProps {
  community: {
    id: string;
    name: string;
    about?: string;
    image?: string;
    creator: string;
    moderators: string[];
  };
}

function MutualSpaceItem({ community }: MutualSpaceItemProps) {
  return (
    <div className="flex items-center space-x-3 p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700/70 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
        {community.image ? (
          <img
            src={community.image}
            alt={community.name}
            className="w-8 h-8 rounded-lg object-cover"
          />
        ) : (
          <Building className="w-4 h-4 text-white" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{community.name}</p>
        {community.about && (
          <p className="text-xs text-gray-400 truncate">{community.about}</p>
        )}
      </div>
    </div>
  );
}

// Activity item components
interface ActivityItemProps {
  event: NostrEvent;
}

function ActivityNoteItem({ event }: ActivityItemProps) {
  const timeAgo = new Date(event.created_at * 1000).toLocaleDateString();

  // Extract image URLs from content (markdown or direct URLs)
  const imageUrls = useMemo(() => {
    const urls: string[] = [];

    // Check for markdown images ![alt](url)
    const markdownImageRegex = /!\[.*?\]\((.*?)\)/g;
    let match;
    while ((match = markdownImageRegex.exec(event.content)) !== null) {
      urls.push(match[1]);
    }

    // Check for direct image URLs
    const urlRegex = /(https?:\/\/.*?\.(jpg|jpeg|png|gif|webp))/gi;
    while ((match = urlRegex.exec(event.content)) !== null) {
      urls.push(match[1]);
    }

    // Check for imeta tags
    event.tags.forEach(([name, ...values]) => {
      if (name === 'imeta') {
        const urlTag = values.find(v => v.startsWith('url '));
        if (urlTag) {
          urls.push(urlTag.substring(4));
        }
      }
    });

    return [...new Set(urls)]; // Remove duplicates
  }, [event.content, event.tags]);

  // Process content to handle nostr: links and remove image markdown/URLs
  const processedContent = event.content
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove markdown images
    .replace(/https?:\/\/.*?\.(jpg|jpeg|png|gif|webp)/gi, '') // Remove direct image URLs
    .replace(/nostr:(npub1|nprofile1|note1|nevent1|naddr1)([023456789acdefghjklmnpqrstuvwxyz]+)/g, (match, prefix, data) => {
      try {
        const decoded = nip19.decode(`${prefix}${data}`);

        if (decoded.type === 'npub' || decoded.type === 'nprofile') {
          const pubkey = decoded.type === 'npub' ? decoded.data : decoded.data.pubkey;
          return `@${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
        } else if (decoded.type === 'note' || decoded.type === 'nevent' || decoded.type === 'naddr') {
          return `[${decoded.type.toUpperCase()}]`;
        }
      } catch {
        // If decoding fails, return original match
        return match;
      }
      return match;
    })
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  const hasContent = processedContent.length > 0;
  const content = hasContent && processedContent.length > 80 ? `${processedContent.slice(0, 80)}...` : processedContent;

  return (
    <div className="group relative p-4 rounded-xl bg-gradient-to-br from-gray-800/60 to-gray-700/40 border border-gray-600/30 hover:from-gray-700/70 hover:to-gray-600/50 hover:border-gray-500/40 transition-all duration-200 shadow-sm hover:shadow-md">

      {/* Render images */}
      {imageUrls.length > 0 && (
        <div className="mb-4">
          {imageUrls.length === 1 ? (
            // Single image - larger display
            <div className="relative group/image overflow-hidden rounded-lg">
              <img
                src={imageUrls[0]}
                alt="Note image"
                className="w-full h-32 lg:h-36 object-cover transition-transform group-hover/image:scale-105"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
          ) : (
            // Multiple images - grid layout
            <div className="grid grid-cols-2 gap-2">
              {imageUrls.slice(0, 4).map((url, index) => (
                <div key={index} className="relative group/image overflow-hidden rounded-lg">
                  <img
                    src={url}
                    alt={`Note image ${index + 1}`}
                    className="w-full h-20 lg:h-24 object-cover transition-transform group-hover/image:scale-105"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  {index === 3 && imageUrls.length > 4 && (
                    <div className="absolute inset-0 bg-black/80 rounded-lg flex items-center justify-center backdrop-blur-sm">
                      <span className="text-white text-sm font-semibold">+{imageUrls.length - 4}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Render text content if available */}
      {hasContent && (
        <div className="mb-3">
          <p className="text-sm text-gray-200 leading-relaxed line-clamp-3">{content}</p>
        </div>
      )}

      {/* Timestamp - clickable */}
      <div className="flex items-center justify-end text-xs text-gray-400">
        <button
          onClick={() => window.open(createNjumpUrl(event), '_blank')}
          className="font-medium hover:text-blue-400 transition-colors cursor-pointer"
          title="View on njump.me"
        >
          {timeAgo}
        </button>
      </div>
    </div>
  );
}



function ActivityImageGalleryItem({ event }: ActivityItemProps) {
  // Extract image data from NIP-68 imeta tags
  const imetaTag = event.tags.find(([name]) => name === 'imeta');
  let imageUrl = '';
  let alt = 'Image';

  if (imetaTag) {
    // Parse imeta tag format: ["imeta", "url <url>", "alt <alt>", ...]
    for (let i = 1; i < imetaTag.length; i++) {
      const param = imetaTag[i];
      const spaceIndex = param.indexOf(' ');
      if (spaceIndex > 0) {
        const key = param.substring(0, spaceIndex);
        const value = param.substring(spaceIndex + 1);
        if (key === 'url') imageUrl = value;
        if (key === 'alt') alt = value;
      }
    }
  }

  return (
    <div
      className="group relative aspect-square overflow-hidden rounded-lg bg-gray-800/50 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg"
      onClick={() => window.open(createNjumpUrl(event), '_blank')}
      title="Click to view full image"
    >
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt={alt}
            className="w-full h-full object-cover transition-transform group-hover:scale-110"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200"></div>
          <div className="absolute inset-0 border border-gray-600/50 group-hover:border-gray-400/70 rounded-lg transition-colors duration-200"></div>
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-700/50">
          <Image className="w-8 h-8 text-gray-500" />
        </div>
      )}
    </div>
  );
}

function ActivityArticleItem({ event }: ActivityItemProps) {
  const timeAgo = new Date(event.created_at * 1000).toLocaleDateString();

  // Extract article metadata from tags
  const title = event.tags.find(([name]) => name === 'title')?.[1] || 'Untitled Article';
  const summary = event.tags.find(([name]) => name === 'summary')?.[1];
  const displayContent = summary || (event.content.length > 60 ? `${event.content.slice(0, 60)}...` : event.content);

  return (
    <div className="group relative p-4 rounded-xl bg-gradient-to-br from-gray-800/60 to-gray-700/40 border border-gray-600/30 hover:from-gray-700/70 hover:to-gray-600/50 hover:border-gray-500/40 transition-all duration-200 shadow-sm hover:shadow-md">

      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-white line-clamp-2 leading-tight group-hover:text-purple-200 transition-colors">{title}</h4>
        </div>

        {displayContent && (
          <div className="border-l-2 border-purple-400/30 pl-3">
            <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">{displayContent}</p>
          </div>
        )}

        {/* Timestamp - clickable */}
        <div className="flex items-center justify-end text-xs text-gray-400 pt-1">
          <button
            onClick={() => window.open(createNjumpUrl(event), '_blank')}
            className="font-medium hover:text-purple-400 transition-colors cursor-pointer"
            title="View on njump.me"
          >
            {timeAgo}
          </button>
        </div>
      </div>
    </div>
  );
}
