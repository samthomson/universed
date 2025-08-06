import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMutualFriends } from "@/hooks/useFollowers";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";
import { useNavigate } from "react-router-dom";
import { useManageFriends } from "@/hooks/useManageFriends";
import { useToast } from "@/hooks/useToast";

interface FriendItemProps {
  friend: { pubkey: string; relay?: string; petname?: string };
  onMessage: (pubkey: string) => void;
  onRemove?: (pubkey: string, displayName: string) => void;
}

interface FriendsListProps {
  mutualFriends?: { pubkey: string; relay?: string; petname?: string }[];
  isLoading?: boolean;
  isVirtualized?: boolean;
}

export function FriendItem({ friend, onMessage }: FriendItemProps) {
  const author = useAuthor(friend.pubkey);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || friend.petname || genUserName(friend.pubkey);
  const profileImage = metadata?.picture;

  return (
    <div onClick={() => onMessage(friend.pubkey)} className="cursor-pointer flex items-center justify-between group hover:bg-secondary/20 rounded-lg p-2 transition-colors">
      <div className="flex space-x-3 flex-1 min-w-0">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={profileImage} alt={displayName} />
          <AvatarFallback className="text-xs">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{displayName}</p>
          {metadata?.nip05 && (
            <p className="text-xs text-muted-foreground truncate">
              {metadata.nip05}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function FriendsList({ mutualFriends: propMutualFriends, isLoading: propIsLoading, isVirtualized = false }: FriendsListProps = {}) {
  const { data: hookMutualFriends, isLoading: hookIsLoading } = useMutualFriends();
  const { removeFriend } = useManageFriends();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Use props if provided, otherwise use hook data
  const mutualFriends = propMutualFriends || hookMutualFriends;
  const isLoading = propIsLoading !== undefined ? propIsLoading : hookIsLoading;

  const handleRemoveFriend = async (pubkey: string, displayName: string) => {
    try {
      await removeFriend(pubkey);
      toast({
        title: "Friend removed",
        description: `Removed ${displayName} from your friends list`,
      });
    } catch (error) {
      toast({
        title: "Failed to remove friend",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleMessageFriend = (pubkey: string) => {
    navigate(`/dm/${pubkey}`);
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <h3 className="font-semibold text-sm text-muted-foreground mb-3">FRIENDS</h3>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    );
  }

  if (!mutualFriends || mutualFriends.length === 0) {
    return (
      <div className="p-4">
        <h3 className="font-semibold text-sm text-muted-foreground mb-3">FRIENDS</h3>
        <p className="text-sm text-muted-foreground">No mutual friends yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Friends appear when you follow each other
        </p>
      </div>
    );
  }

  // For virtualized mode, we only render the header since items will be rendered individually
  if (isVirtualized) {
    return (
      <div className="p-4">
        <h3 className="font-semibold text-sm text-muted-foreground mb-3">FRIENDS</h3>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="font-semibold text-sm text-muted-foreground mb-3">FRIENDS</h3>
      <div className="space-y-1">
        {mutualFriends.map((friend) => (
          <FriendItem
            key={friend.pubkey}
            friend={friend}
            onMessage={handleMessageFriend}
            onRemove={handleRemoveFriend}
          />
        ))}
      </div>
    </div>
  );
}
