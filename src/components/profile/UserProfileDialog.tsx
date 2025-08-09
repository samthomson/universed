import { MessageCircle, Link as LinkIcon, X, Copy, Check, UserPlus, Zap, MoreHorizontal, Flag, VolumeX, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserStatus, useUserMusicStatus } from "@/hooks/useUserStatus";
import { UserStatusIndicator } from "@/components/user/UserStatusIndicator";
import { ZapDialog } from "@/components/ZapDialog";
import { ReportUserDialog } from "@/components/reporting/ReportUserDialog";
import { useIsFriend } from "@/hooks/useFriends";
import { useManageFriends } from "@/hooks/useManageFriends";
import { useManageMutedUsers } from "@/hooks/useManageMutedUsers";
import { useIsMuted } from "@/hooks/useMutedUsers";
import { genUserName } from "@/lib/genUserName";

import { nip19 } from "nostr-tools";
import { useState } from "react";
import { toast } from "sonner";

interface UserProfileDialogProps {
  pubkey: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartDM?: (pubkey: string) => void;
}

export function UserProfileDialog({ pubkey, open, onOpenChange, onStartDM }: UserProfileDialogProps) {
  const { user } = useCurrentUser();
  const author = useAuthor(pubkey || "");
  const { data: userStatus } = useUserStatus(pubkey ?? undefined);
  const { data: musicStatus } = useUserMusicStatus(pubkey ?? undefined);
  const metadata = author.data?.metadata;
  const [copied, setCopied] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);

  // Follow state and actions
  const isFollowing = useIsFriend(pubkey || "");
  const { addFriend, removeFriend, isAddingFriend, isRemovingFriend } = useManageFriends();

  // Mute state and actions (NIP-51 compliant)
  const isMuted = useIsMuted(pubkey || "");
  const { muteUser, unmuteUser, isMuting, isUnmuting } = useManageMutedUsers();

  if (!pubkey) return null;

  const displayName = metadata?.name || genUserName(pubkey);
  const profileImage = metadata?.picture;
  const banner = metadata?.banner;
  const about = metadata?.about;
  const website = metadata?.website;
  const nip05 = metadata?.nip05;
  const npub = nip19.npubEncode(pubkey);

  const isOwnProfile = user?.pubkey === pubkey;

  const handleStartDM = () => {
    onStartDM?.(pubkey);
    onOpenChange(false);
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
    if (!pubkey) return;

    try {
      if (isFollowing) {
        await removeFriend(pubkey);
      } else {
        // Get user's preferred relay from their profile metadata
        const userRelay = metadata?.nip05 ? `wss://${metadata.nip05.split('@')[1]}` : undefined;
        await addFriend({
          pubkey,
          relay: userRelay,
          petname: displayName
        });
      }
    } catch (error) {
      // Error handling is already done in the useManageFriends hook
      console.error('Follow/unfollow error:', error);
    }
  };

  const handleToggleMute = async () => {
    if (!pubkey) return;

    try {
      if (isMuted) {
        await unmuteUser(pubkey);
      } else {
        await muteUser(pubkey);
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
    id: `fake-${pubkey}`,
    pubkey: pubkey || "",
    kind: 0,
    content: '',
    tags: [],
    created_at: Math.floor(Date.now() / 1000),
    sig: ''
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 bg-gray-900 border-gray-700 shadow-xl">
        <div className="relative">
          {/* Banner */}
          {banner && (
            <div
              className="h-24 bg-cover bg-center rounded-t-lg"
              style={{ backgroundImage: `url(${banner})` }}
            />
          )}

          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-4 h-4" />
          </Button>

          <div className="p-6">
            {/* Avatar */}
            <div className={`flex flex-col items-center text-center ${banner ? '-mt-12' : ''}`}>
              <div className={`relative ${banner ? 'mb-4' : 'mb-3'}`}>
                <Avatar className="w-20 h-20 border-4 border-gray-900">
                  <AvatarImage src={profileImage} alt={displayName} />
                  <AvatarFallback className="bg-indigo-600 text-white text-lg">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Status indicator positioned on avatar */}
                <div className="absolute bottom-2 right-1.5">
                  <UserStatusIndicator pubkey={pubkey} className="scale-125" />
                </div>
              </div>

              {/* Profile Info */}
              <div className="space-y-3 w-full">
                <div>
                  <h2 className="text-xl font-bold text-white">{displayName}</h2>

                  {/* Status message */}
                  {(userStatus?.emoji || userStatus?.message) && (
                    <div className="flex items-center justify-center space-x-1 mt-2">
                      <span className="text-sm">🌌</span>
                      {userStatus.emoji && (
                        <span className="text-sm">{userStatus.emoji}</span>
                      )}
                      {userStatus.message && (
                        <p className="text-sm text-gray-300">{userStatus.message}</p>
                      )}
                    </div>
                  )}

                  {/* Music Status */}
                  {musicStatus && musicStatus.content && (
                    <div className="flex items-center justify-center space-x-1 mt-1">
                      <Music className="w-3 h-3 text-purple-500" />
                      <p className="text-sm text-gray-300 truncate">
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

                  <div className="flex items-center justify-center space-x-2 mt-1">
                    <p className="text-gray-400 text-sm">@{npub.slice(0, 16)}...</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCopyNpub}
                      className="h-6 w-6 hover:bg-gray-700"
                      title="Copy npub"
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3 text-gray-400" />
                      )}
                    </Button>
                  </div>
                  {nip05 && (
                    <Badge variant="secondary" className="mt-2 text-xs bg-green-900/30 text-green-400 border-green-700">
                      ✓ {nip05}
                    </Badge>
                  )}
                </div>

                {about && (
                  <p className="text-gray-300 text-sm leading-relaxed">{about}</p>
                )}

                {/* Metadata */}
                <div className="space-y-2 text-xs text-gray-400">
                  {website && (
                    <div className="flex items-center justify-center space-x-1">
                      <LinkIcon className="w-3 h-3" />
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

                {/* Action buttons */}
                {!isOwnProfile && (
                  <div className="flex items-center space-x-2 pt-2">
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
      </DialogContent>

      {/* Report Dialog */}
      <ReportUserDialog
        targetPubkey={pubkey || ""}
        targetDisplayName={displayName}
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
      />
    </Dialog>
  );
}