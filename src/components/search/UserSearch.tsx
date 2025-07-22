import { useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { useUserSearch } from "@/hooks/useUserSearch";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";
import { nip19 } from "nostr-tools";
import { useNavigate } from "react-router-dom";

interface UserSearchProps {
  onUserSelect?: (pubkey: string) => void;
  placeholder?: string;
}

interface UserResultProps {
  pubkey: string;
  onSelect?: (pubkey: string) => void;
}

function UserResult({ pubkey, onSelect }: UserResultProps) {
  const navigate = useNavigate();
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;

  const displayName = metadata?.name || genUserName(pubkey);
  const profileImage = metadata?.picture;
  const about = metadata?.about;
  const npub = nip19.npubEncode(pubkey);

  const handleClick = () => {
    if (onSelect) {
      onSelect(pubkey);
    } else {
      navigate(`/profile/${npub}`);
    }
  };

  return (
    <Card className="hover:bg-gray-700 transition-colors cursor-pointer" onClick={handleClick}>
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          <Avatar className="w-12 h-12">
            <AvatarImage src={profileImage} alt={displayName} />
            <AvatarFallback className="bg-indigo-600 text-white">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white truncate">{displayName}</h3>
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-gray-400 hover:text-gray-300"
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Add friend functionality
                }}
              >
                <UserPlus className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-sm text-gray-400 truncate">
              {npub.slice(0, 16)}...
            </p>

            {about && (
              <p className="text-sm text-gray-300 mt-1 line-clamp-2">
                {about}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function UserSearch({ onUserSelect, placeholder = "Search users..." }: UserSearchProps) {
  const [query, setQuery] = useState("");
  const { data: users, isLoading } = useUserSearch(query);

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 bg-gray-600 border-gray-500 text-gray-100 placeholder:text-gray-400"
        />
      </div>

      {/* Results */}
      {query.trim() && (
        <div className="space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gray-600 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-600 rounded w-1/3" />
                        <div className="h-3 bg-gray-600 rounded w-1/2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : users && users.length > 0 ? (
            users.map((pubkey) => (
              <UserResult
                key={pubkey}
                pubkey={pubkey}
                onSelect={onUserSelect}
              />
            ))
          ) : (
            <Card>
              <CardContent className="p-4 text-center text-gray-400">
                <p>No users found</p>
                <p className="text-sm mt-1">Try a different search term</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}