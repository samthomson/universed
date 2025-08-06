import { MessageCircle, Calendar, Link as LinkIcon, X, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserStatus } from "@/hooks/useUserStatus";
import { UserStatusIndicator } from "@/components/user/UserStatusIndicator";
import { genUserName } from "@/lib/genUserName";
import { formatDistanceToNowShort } from "@/lib/formatTime";
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
  const metadata = author.data?.metadata;
  const [copied, setCopied] = useState(false);

  if (!pubkey) return null;

  const displayName = metadata?.name || genUserName(pubkey);
  const profileImage = metadata?.picture;
  const banner = metadata?.banner;
  const about = metadata?.about;
  const website = metadata?.website;
  const nip05 = metadata?.nip05;
  const npub = nip19.npubEncode(pubkey);

  const isOwnProfile = user?.pubkey === pubkey;
  const joinDate = author.data?.event ? new Date(author.data.event.created_at * 1000) : null;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 bg-gray-800 border-gray-600">
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
              <Avatar className={`w-20 h-20 border-4 border-gray-800 ${banner ? 'mb-4' : 'mb-3'}`}>
                <AvatarImage src={profileImage} alt={displayName} />
                <AvatarFallback className="bg-indigo-600 text-white text-lg">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              {/* Profile Info */}
              <div className="space-y-3 w-full">
                <div>
                  <h2 className="text-xl font-bold text-white">{displayName}</h2>
                  
                  {/* Status Display */}
                  {(userStatus?.emoji || userStatus?.status || userStatus?.message) && (
                    <div className="flex items-center justify-center space-x-2 mt-2">
                      <UserStatusIndicator pubkey={pubkey} showText={true} />
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
                    <Badge variant="secondary" className="mt-2 text-xs">
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

                  {joinDate && (
                    <div className="flex items-center justify-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>Joined {formatDistanceToNowShort(joinDate, { addSuffix: true })}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {!isOwnProfile && (
                  <div className="flex items-center justify-center pt-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleStartDM}
                      className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Message</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}