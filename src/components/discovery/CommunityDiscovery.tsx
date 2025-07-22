import { useState } from "react";
import { Search, Users, Hash, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCommunities } from "@/hooks/useCommunities";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";
import type { Community } from "@/hooks/useCommunities";

interface CommunityDiscoveryProps {
  onCommunitySelect?: (communityId: string) => void;
}

interface CommunityCardProps {
  community: Community;
  onSelect?: (communityId: string) => void;
}

function CommunityCard({ community, onSelect }: CommunityCardProps) {
  const author = useAuthor(community.creator);
  const metadata = author.data?.metadata;
  
  const creatorName = metadata?.name || genUserName(community.creator);
  const memberCount = community.moderators.length + 1; // Creator + moderators (simplified)

  return (
    <Card className="hover:bg-gray-700 transition-colors cursor-pointer" onClick={() => onSelect?.(community.id)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {community.image ? (
              <Avatar className="w-12 h-12">
                <AvatarImage src={community.image} alt={community.name} />
                <AvatarFallback>
                  {community.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-semibold">
                {community.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg text-white truncate">
                {community.name}
              </CardTitle>
              <p className="text-sm text-gray-400">
                by {creatorName}
              </p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-gray-400 hover:text-gray-300"
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(community.id);
            }}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {community.description && (
          <p className="text-sm text-gray-300 mb-3 line-clamp-2">
            {community.description}
          </p>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 text-sm text-gray-400">
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4" />
              <span>{memberCount} members</span>
            </div>
            <div className="flex items-center space-x-1">
              <Hash className="w-4 h-4" />
              <span>3 channels</span> {/* Simplified - could be dynamic */}
            </div>
          </div>
          
          <Badge variant="secondary" className="text-xs">
            Public
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export function CommunityDiscovery({ onCommunitySelect }: CommunityDiscoveryProps) {
  const [query, setQuery] = useState("");
  const { data: communities, isLoading } = useCommunities();

  // Filter communities based on search query
  const filteredCommunities = communities?.filter(community => {
    if (!query.trim()) return true;
    
    const searchText = [
      community.name,
      community.description,
    ].filter(Boolean).join(' ').toLowerCase();
    
    return searchText.includes(query.toLowerCase());
  }) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">Discover Communities</h2>
        <p className="text-gray-400">Find and join communities that interest you</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search communities..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 bg-gray-600 border-gray-500 text-gray-100 placeholder:text-gray-400"
        />
      </div>

      {/* Communities Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gray-600 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-gray-600 rounded w-3/4" />
                    <div className="h-4 bg-gray-600 rounded w-1/2" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-600 rounded w-full" />
                  <div className="h-4 bg-gray-600 rounded w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredCommunities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCommunities.map((community) => (
            <CommunityCard
              key={community.id}
              community={community}
              onSelect={onCommunitySelect}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-gray-400">
            <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No communities found</h3>
            <p className="text-sm">
              {query.trim() ? "Try a different search term" : "No communities available yet"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}