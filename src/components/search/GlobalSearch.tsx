import { useState } from "react";
import { Search, MessageSquare, Users, Hash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserSearch } from "./UserSearch";
import { CommunityDiscovery } from "../discovery/CommunityDiscovery";
import { useGlobalMessageSearch } from "@/hooks/useGlobalMessageSearch";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";
import { formatDistanceToNow } from "date-fns";
import type { NostrEvent } from "@nostrify/nostrify";

interface GlobalSearchProps {
  onUserSelect?: (pubkey: string) => void;
  onCommunitySelect?: (communityId: string) => void;
  onMessageSelect?: (message: NostrEvent) => void;
}

interface MessageResultProps {
  message: NostrEvent;
  onSelect?: (message: NostrEvent) => void;
}

function MessageResult({ message, onSelect }: MessageResultProps) {
  const author = useAuthor(message.pubkey);
  const metadata = author.data?.metadata;
  
  const displayName = metadata?.name || genUserName(message.pubkey);
  const profileImage = metadata?.picture;
  const timestamp = new Date(message.created_at * 1000);

  // Extract community info if it's a community message
  const aTag = message.tags.find(([name]) => name === 'a' || name === 'A');
  const communityId = aTag?.[1];
  const isCommunityMessage = !!communityId;

  return (
    <Card className="hover:bg-gray-700 transition-colors cursor-pointer" onClick={() => onSelect?.(message)}>
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={profileImage} alt={displayName} />
            <AvatarFallback className="bg-indigo-600 text-white text-sm">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <span className="font-medium text-white">{displayName}</span>
              {isCommunityMessage && (
                <Badge variant="secondary" className="text-xs">
                  <Hash className="w-3 h-3 mr-1" />
                  Community
                </Badge>
              )}
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(timestamp, { addSuffix: true })}
              </span>
            </div>
            
            <p className="text-sm text-gray-300 line-clamp-3">
              {message.content}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function GlobalSearch({ onUserSelect, onCommunitySelect, onMessageSelect }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const { data: messages, isLoading: isLoadingMessages } = useGlobalMessageSearch(query);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">Search</h2>
        <p className="text-gray-400">Search across messages, users, and communities</p>
      </div>

      {/* Global Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search everything..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 bg-gray-600 border-gray-500 text-gray-100 placeholder:text-gray-400"
        />
      </div>

      {/* Search Results Tabs */}
      <Tabs defaultValue="messages" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gray-700">
          <TabsTrigger value="messages" className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4" />
            <span>Messages</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Users</span>
          </TabsTrigger>
          <TabsTrigger value="communities" className="flex items-center space-x-2">
            <Hash className="w-4 h-4" />
            <span>Communities</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="space-y-4">
          {query.trim() ? (
            isLoadingMessages ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 bg-gray-600 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-600 rounded w-1/3" />
                          <div className="h-4 bg-gray-600 rounded w-full" />
                          <div className="h-4 bg-gray-600 rounded w-2/3" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : messages && messages.length > 0 ? (
              <div className="space-y-2">
                {messages.map((message) => (
                  <MessageResult
                    key={message.id}
                    message={message}
                    onSelect={onMessageSelect}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-gray-400">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No messages found</h3>
                  <p className="text-sm">Try a different search term</p>
                </CardContent>
              </Card>
            )
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-gray-400">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">Search Messages</h3>
                <p className="text-sm">Enter a search term to find messages</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="users">
          <UserSearch onUserSelect={onUserSelect} placeholder="Search users..." />
        </TabsContent>

        <TabsContent value="communities">
          <CommunityDiscovery onCommunitySelect={onCommunitySelect} />
        </TabsContent>
      </Tabs>
    </div>
  );
}