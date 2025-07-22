import { Settings, Mic, MicOff, Headphones, HeadphonesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";
import { useState } from "react";

export function UserPanel() {
  const { user } = useCurrentUser();
  const author = useAuthor(user?.pubkey || '');
  const metadata = author.data?.metadata;
  
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  if (!user) return null;

  const displayName = metadata?.name || genUserName(user.pubkey);
  const profileImage = metadata?.picture;

  return (
    <div className="h-16 bg-gray-800 border-t border-gray-600 flex items-center justify-between px-2">
      {/* User Info */}
      <div className="flex items-center space-x-2 flex-1 min-w-0">
        <Avatar className="w-8 h-8">
          <AvatarImage src={profileImage} alt={displayName} />
          <AvatarFallback className="bg-indigo-600 text-white text-xs">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">
            {displayName}
          </div>
          <div className="text-xs text-gray-400 truncate">
            #{user.pubkey.slice(0, 8)}...
          </div>
        </div>
      </div>

      {/* Voice Controls */}
      <div className="flex items-center space-x-1">
        <Button
          variant="ghost"
          size="icon"
          className={`w-8 h-8 ${isMuted ? 'text-red-400 bg-red-400/20' : 'text-gray-400 hover:text-gray-300'}`}
          onClick={() => setIsMuted(!isMuted)}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className={`w-8 h-8 ${isDeafened ? 'text-red-400 bg-red-400/20' : 'text-gray-400 hover:text-gray-300'}`}
          onClick={() => setIsDeafened(!isDeafened)}
          title={isDeafened ? "Undeafen" : "Deafen"}
        >
          {isDeafened ? <HeadphonesIcon className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 text-gray-400 hover:text-gray-300"
          title="User Settings"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}