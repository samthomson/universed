import { Search, Phone, Video, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DMMessageList } from "./DMMessageList";
import { DMMessageInput } from "./DMMessageInput";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";

interface DMChatAreaProps {
  conversationId: string; // The other person's pubkey
}

export function DMChatArea({ conversationId }: DMChatAreaProps) {
  const author = useAuthor(conversationId);
  const metadata = author.data?.metadata;

  const displayName = metadata?.name || genUserName(conversationId);
  const profileImage = metadata?.picture;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-16 border-b border-gray-600 flex items-center justify-between px-4 bg-gray-800">
        <div className="flex items-center space-x-3">
          <Avatar className="w-8 h-8">
            <AvatarImage src={profileImage} alt={displayName} />
            <AvatarFallback className="bg-indigo-600 text-white text-xs">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-white">{displayName}</h3>
            <p className="text-xs text-gray-400">Online</p> {/* Mock status */}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" className="w-8 h-8">
            <Phone className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8">
            <Video className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8">
            <Search className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 flex flex-col">
        <DMMessageList conversationId={conversationId} />

        {/* Message Input */}
        <div className="p-4 border-t border-gray-600">
          <DMMessageInput conversationId={conversationId} />
        </div>
      </div>
    </div>
  );
}