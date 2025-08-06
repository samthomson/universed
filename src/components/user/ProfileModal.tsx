import { useState } from "react";
import { 
  Dialog, 
  DialogContent 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserStatusIndicator } from "@/components/user/UserStatusIndicator";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";
import { useUserStatus, useUpdateUserStatus } from "@/hooks/useUserStatus";
import { genUserName } from "@/lib/genUserName";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { 
  Edit, 
  Settings, 
  MoreHorizontal,
  Globe,
  Check,
  Clock,
  XCircle,
  Circle,
  Copy,
  ChevronDown
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { nip19 } from "nostr-tools";
import { toast } from "sonner";

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
}

const statusOptions = [
  { value: 'online', label: 'Online', icon: Check, color: 'text-green-500' },
  { value: 'away', label: 'Away', icon: Clock, color: 'text-yellow-500' },
  { value: 'busy', label: 'Busy', icon: XCircle, color: 'text-red-500' },
  { value: 'offline', label: 'Offline', icon: Circle, color: 'text-gray-500' },
];

export function ProfileModal({ 
  open, 
  onOpenChange,
  onOpenSettings 
}: ProfileModalProps) {
  const { user } = useCurrentUser();
  const author = useAuthor(user?.pubkey || '');
  const metadata = author.data?.metadata;
  const { data: userStatus } = useUserStatus(user?.pubkey);
  const updateUserStatus = useUpdateUserStatus();
  const navigate = useNavigate();

  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const displayName = metadata?.name || genUserName(user.pubkey);
  const profileImage = metadata?.picture;
  const banner = metadata?.banner;
  const about = metadata?.about;
  const website = metadata?.website;
  const nip05 = metadata?.nip05;
  const npub = nip19.npubEncode(user.pubkey);

  const handleStatusChange = (status: string) => {
    updateUserStatus.mutate({
      status: status as 'online' | 'away' | 'busy' | 'offline',
      customMessage: userStatus?.customMessage || ''
    });
    setStatusDropdownOpen(false);
  };

  const handleEditProfile = () => {
    navigate(`/profile/${npub}/edit`);
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

          <div className="p-6">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => onOpenChange(false)}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>

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
                  <div className="flex items-center justify-center space-x-2">
                    <h2 className="text-xl font-bold text-white">{displayName}</h2>
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
                  </div>
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
                <div className="flex items-center justify-center space-x-2 pt-2">
                  <DropdownMenu open={statusDropdownOpen} onOpenChange={setStatusDropdownOpen}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center space-x-2 border-gray-600 text-gray-300 hover:bg-gray-700 h-8 px-3"
                      >
                        <UserStatusIndicator pubkey={user.pubkey} />
                        <span className="text-xs">
                          {statusOptions.find(opt => opt.value === userStatus?.status)?.label || 'Online'}
                        </span>
                        <ChevronDown className="w-3 h-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-gray-700 border-gray-600">
                      {statusOptions.map((option) => {
                        const Icon = option.icon;
                        return (
                          <DropdownMenuItem
                            key={option.value}
                            onClick={() => handleStatusChange(option.value)}
                            className="text-gray-300 hover:bg-gray-600 hover:text-white cursor-pointer"
                          >
                            <Icon className={`w-4 h-4 mr-2 ${option.color}`} />
                            {option.label}
                          </DropdownMenuItem>
                        );
                      })}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setStatusDropdownOpen(false)}
                        className="text-gray-300 hover:bg-gray-600 hover:text-white cursor-pointer"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Custom Status
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

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
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
