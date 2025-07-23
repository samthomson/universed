import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import {
  BookOpen,
  Plus,
  Search,
  Grid3X3,
  List,
  FileText,
  Link as LinkIcon,
  Folder,
  Download,
  Calendar,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { NostrEvent } from '@nostrify/nostrify';

interface ResourcesSpaceProps {
  communityId: string;
}

interface ResourceCollection {
  id: string;
  name: string;
  description: string;
  image?: string;
  resources: Resource[];
  creator: string;
  createdAt: number;
  tags: string[];
  event: NostrEvent;
}

interface Resource {
  type: 'url' | 'note' | 'article' | 'file';
  url?: string;
  eventId?: string;
  title?: string;
  description?: string;
  tags: string[];
}

// Validate NIP-51 bookmark set events
function validateResourceEvent(event: NostrEvent): boolean {
  if (event.kind !== 30003) return false; // NIP-51 bookmark sets

  const d = event.tags.find(([name]) => name === 'd')?.[1];
  if (!d) return false;

  return true;
}

function parseResourceEvent(event: NostrEvent): ResourceCollection | null {
  try {
    const d = event.tags.find(([name]) => name === 'd')?.[1] || '';
    const title = event.tags.find(([name]) => name === 'title')?.[1] || d;
    const description = event.tags.find(([name]) => name === 'description')?.[1] || '';
    const image = event.tags.find(([name]) => name === 'image')?.[1];

    // Extract resources from tags
    const resources: Resource[] = [];

    // URL resources
    event.tags.filter(([name]) => name === 'r').forEach(([, url]) => {
      resources.push({
        type: 'url',
        url,
        title: new URL(url).hostname,
        tags: [],
      });
    });

    // Note resources (kind 1)
    event.tags.filter(([name]) => name === 'e').forEach(([, eventId]) => {
      resources.push({
        type: 'note',
        eventId,
        title: 'Nostr Note',
        tags: [],
      });
    });

    // Article resources (kind 30023)
    event.tags.filter(([name]) => name === 'a').forEach(([, addr]) => {
      if (addr.startsWith('30023:')) {
        resources.push({
          type: 'article',
          eventId: addr,
          title: 'Long-form Article',
          tags: [],
        });
      }
    });

    // Extract hashtags
    const tags = event.tags
      .filter(([name]) => name === 't')
      .map(([, tag]) => tag);

    return {
      id: d,
      name: title,
      description,
      image,
      resources,
      creator: event.pubkey,
      createdAt: event.created_at,
      tags,
      event,
    };
  } catch {
    return null;
  }
}

export function ResourcesSpace({ communityId }: ResourcesSpaceProps) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('newest');

  // Query resource collections (NIP-51 bookmark sets)
  const { data: collections, isLoading } = useQuery({
    queryKey: ['resource-collections', communityId, searchQuery, selectedTag, sortBy],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Query for NIP-51 bookmark set events
      const events = await nostr.query([
        {
          kinds: [30003], // NIP-51 bookmark sets
          '#t': selectedTag === 'all' ? undefined : [selectedTag],
          limit: 100,
        }
      ], { signal });

      const validEvents = events.filter(validateResourceEvent);
      const collections = validEvents
        .map(parseResourceEvent)
        .filter((collection): collection is ResourceCollection => collection !== null);

      // Filter by search query
      let filteredCollections = collections;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredCollections = collections.filter(collection =>
          collection.name.toLowerCase().includes(query) ||
          collection.description.toLowerCase().includes(query) ||
          collection.tags.some(tag => tag.toLowerCase().includes(query))
        );
      }

      // Sort collections
      filteredCollections.sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return a.name.localeCompare(b.name);
          case 'resources':
            return b.resources.length - a.resources.length;
          case 'oldest':
            return a.createdAt - b.createdAt;
          case 'newest':
          default:
            return b.createdAt - a.createdAt;
        }
      });

      return filteredCollections;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Get unique tags from collections
  const tags = Array.from(new Set(collections?.flatMap(collection => collection.tags) || []));

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'url':
        return <Globe className="w-4 h-4" />;
      case 'note':
        return <FileText className="w-4 h-4" />;
      case 'article':
        return <BookOpen className="w-4 h-4" />;
      case 'file':
        return <Download className="w-4 h-4" />;
      default:
        return <LinkIcon className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <BookOpen className="w-8 h-8 text-green-500" />
          <div>
            <h1 className="text-2xl font-bold">Resources</h1>
            <p className="text-muted-foreground">
              Organized collection of useful links and files
            </p>
          </div>
        </div>
        {user && (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Collection
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedTag} onValueChange={setSelectedTag}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            {tags.map(tag => (
              <SelectItem key={tag} value={tag}>
                #{tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="name">Name A-Z</SelectItem>
            <SelectItem value="resources">Most Resources</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="rounded-r-none"
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="rounded-l-none"
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Results */}
      {collections && collections.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No resource collections found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || selectedTag !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Create the first resource collection for this community!'
              }
            </p>
            {user && (
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create First Collection
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
            : 'space-y-4'
        }>
          {collections?.map((collection) => (
            <ResourceCollectionCard
              key={collection.id}
              collection={collection}
              viewMode={viewMode}
              getResourceIcon={getResourceIcon}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ResourceCollectionCard({
  collection,
  viewMode,
  getResourceIcon
}: {
  collection: ResourceCollection;
  viewMode: 'grid' | 'list';
  getResourceIcon: (type: string) => React.ReactNode;
}) {
  const timeAgo = new Date(collection.createdAt * 1000).toLocaleDateString();

  if (viewMode === 'list') {
    return (
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex space-x-4">
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
              {collection.image ? (
                <img
                  src={collection.image}
                  alt={collection.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <Folder className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{collection.name}</h3>
                  <p className="text-muted-foreground text-sm line-clamp-2">
                    {collection.description}
                  </p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>{timeAgo}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary">
                    {collection.resources.length} resources
                  </Badge>
                  {collection.tags.slice(0, 2).map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      #{tag}
                    </Badge>
                  ))}
                  {collection.tags.length > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{collection.tags.length - 2}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center space-x-1">
                  {collection.resources.slice(0, 3).map((resource, i) => (
                    <div key={i} className="text-muted-foreground">
                      {getResourceIcon(resource.type)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardHeader>
        <div className="flex items-start space-x-3">
          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
            {collection.image ? (
              <img
                src={collection.image}
                alt={collection.name}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <Folder className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg line-clamp-1">{collection.name}</CardTitle>
            <p className="text-muted-foreground text-sm line-clamp-2 mt-1">
              {collection.description}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">
            {collection.resources.length} resources
          </Badge>
          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>{timeAgo}</span>
          </div>
        </div>

        {/* Resource type indicators */}
        <div className="flex items-center space-x-2">
          {collection.resources.slice(0, 4).map((resource, i) => (
            <div key={i} className="flex items-center space-x-1 text-xs text-muted-foreground">
              {getResourceIcon(resource.type)}
            </div>
          ))}
          {collection.resources.length > 4 && (
            <span className="text-xs text-muted-foreground">
              +{collection.resources.length - 4} more
            </span>
          )}
        </div>

        {/* Tags */}
        {collection.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {collection.tags.slice(0, 3).map(tag => (
              <Badge key={tag} variant="outline" className="text-xs">
                #{tag}
              </Badge>
            ))}
            {collection.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{collection.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}