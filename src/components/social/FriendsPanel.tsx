import { useState } from 'react';
import { MessageCircle, UserPlus, UserMinus, Edit3, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useFriends } from '@/hooks/useFriends';
import { useManageFriends } from '@/hooks/useManageFriends';
import { useAuthor } from '@/hooks/useAuthor';
import { useUserSearch } from '@/hooks/useUserSearch';
import { genUserName } from '@/lib/genUserName';

function UserSearchResult({ pubkey, isSelected, onSelect }: {
  pubkey: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const author = useAuthor(pubkey);
  const displayName = author.data?.metadata?.name || genUserName(pubkey);
  const profileImage = author.data?.metadata?.picture;

  return (
    <div
      className={`flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
        isSelected ? 'bg-blue-100 dark:bg-blue-900' : ''
      }`}
      onClick={onSelect}
    >
      <Avatar className="w-6 h-6">
        <AvatarImage src={profileImage} alt={displayName} />
        <AvatarFallback className="text-xs">
          {displayName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{displayName}</p>
        {author.data?.metadata?.about && (
          <p className="text-xs text-muted-foreground truncate">
            {author.data.metadata.about}
          </p>
        )}
      </div>
    </div>
  );
}

interface FriendsPanelProps {
  onStartDM?: (pubkey: string) => void;
}

function FriendItem({ pubkey, petname, onStartDM, onRemove, onUpdatePetname }: {
  pubkey: string;
  petname?: string;
  onStartDM?: (pubkey: string) => void;
  onRemove: (pubkey: string) => void;
  onUpdatePetname: (pubkey: string, petname: string) => void;
}) {
  const author = useAuthor(pubkey);
  const [isEditingPetname, setIsEditingPetname] = useState(false);
  const [newPetname, setNewPetname] = useState(petname || '');

  const displayName = petname || author.data?.metadata?.name || genUserName(pubkey);
  const profileImage = author.data?.metadata?.picture;

  const handleUpdatePetname = () => {
    onUpdatePetname(pubkey, newPetname);
    setIsEditingPetname(false);
  };

  return (
    <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
      <Avatar className="w-8 h-8">
        <AvatarImage src={profileImage} alt={displayName} />
        <AvatarFallback className="text-xs">
          {displayName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        {isEditingPetname ? (
          <div className="flex items-center space-x-2">
            <Input
              value={newPetname}
              onChange={(e) => setNewPetname(e.target.value)}
              placeholder="Enter petname"
              className="h-6 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUpdatePetname();
                if (e.key === 'Escape') setIsEditingPetname(false);
              }}
              autoFocus
            />
            <Button size="sm" variant="ghost" onClick={handleUpdatePetname}>
              ✓
            </Button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsEditingPetname(true)}
              className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100"
            >
              <Edit3 className="w-3 h-3" />
            </Button>
          </div>
        )}
        {author.data?.metadata?.name && petname && (
          <p className="text-xs text-muted-foreground truncate">
            {author.data.metadata.name}
          </p>
        )}
      </div>

      <div className="flex items-center space-x-1">
        {onStartDM && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onStartDM(pubkey)}
            className="h-6 w-6 p-0"
          >
            <MessageCircle className="w-3 h-3" />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onRemove(pubkey)}
          className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
        >
          <UserMinus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function AddFriendDialog({ onAddFriend }: { onAddFriend: (pubkey: string, petname?: string) => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [petname, setPetname] = useState('');
  const [selectedPubkey, setSelectedPubkey] = useState('');
  const [open, setOpen] = useState(false);

  const { data: searchResults, isLoading } = useUserSearch(searchQuery);

  const handleAddFriend = () => {
    if (selectedPubkey) {
      onAddFriend(selectedPubkey, petname.trim() || undefined);
      setSearchQuery('');
      setPetname('');
      setSelectedPubkey('');
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full">
          <UserPlus className="w-4 h-4 mr-2" />
          Add Friend
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Friend</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search Users</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by name or npub..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {searchQuery && (
            <div className="space-y-2">
              <Label>Search Results</Label>
              <ScrollArea className="h-32 border rounded-md p-2">
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center space-x-2">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <Skeleton className="h-4 flex-1" />
                      </div>
                    ))}
                  </div>
                ) : searchResults?.length ? (
                  <div className="space-y-1">
                    {searchResults.map((pubkey) => {
                      return (
                        <UserSearchResult
                          key={pubkey}
                          pubkey={pubkey}
                          isSelected={selectedPubkey === pubkey}
                          onSelect={() => setSelectedPubkey(pubkey)}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No users found
                  </p>
                )}
              </ScrollArea>
            </div>
          )}

          {selectedPubkey && (
            <div className="space-y-2">
              <Label htmlFor="petname">Petname (optional)</Label>
              <Input
                id="petname"
                placeholder="Enter a nickname for this friend"
                value={petname}
                onChange={(e) => setPetname(e.target.value)}
              />
            </div>
          )}

          <Button
            onClick={handleAddFriend}
            disabled={!selectedPubkey}
            className="w-full"
          >
            Add Friend
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FriendsPanel({ onStartDM }: FriendsPanelProps) {
  const { data: friends, isLoading } = useFriends();
  const { addFriend, removeFriend, updateFriendPetname } = useManageFriends();

  const handleAddFriend = async (pubkey: string, petname?: string) => {
    try {
      await addFriend({ pubkey, petname });
    } catch {
      // Error is handled in the hook
    }
  };

  const handleRemoveFriend = async (pubkey: string) => {
    try {
      await removeFriend(pubkey);
    } catch {
      // Error is handled in the hook
    }
  };

  const handleUpdatePetname = async (pubkey: string, petname: string) => {
    try {
      await updateFriendPetname({ pubkey, petname });
    } catch {
      // Error is handled in the hook
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Friends</CardTitle>
          <span className="text-sm text-muted-foreground">
            {friends?.length || 0}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col space-y-4">
        <AddFriendDialog onAddFriend={handleAddFriend} />

        <div className="flex-1">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-3">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : friends?.length ? (
            <ScrollArea className="h-full">
              <div className="space-y-1 group">
                {friends.map((friend) => (
                  <FriendItem
                    key={friend.pubkey}
                    pubkey={friend.pubkey}
                    petname={friend.petname}
                    onStartDM={onStartDM}
                    onRemove={handleRemoveFriend}
                    onUpdatePetname={handleUpdatePetname}
                  />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No friends yet</p>
              <p className="text-xs">Add friends to start building your network!</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}