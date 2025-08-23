import { useState } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Grid3X3,
  List,
  FileText,
  Folder,
  Calendar,
  Globe,
  Users,
  Shield,
  Crown,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserCommunityMembership } from '@/hooks/useUserCommunityMembership';
import { useToast } from '@/hooks/useToast';
import { MembershipCTA } from '@/components/community/MembershipCTA';
import { CreateResourceFolderDialog } from './CreateResourceFolderDialog';
import { AddResourceToFolderDialog } from './AddResourceToFolderDialog';
import { useResourceFolders, useFolderResources } from '@/hooks/useResourceFolders';

import { useUserRole } from '@/hooks/useCommunityRoles';
import type { ResourceFolder, FolderResource } from '@/hooks/useResourceFolders';

interface ResourcesSpaceProps {
  communityId: string;
}

export function ResourcesSpace({ communityId }: ResourcesSpaceProps) {
  const { user } = useCurrentUser();
  const { role } = useUserRole(communityId, user?.pubkey);
  const { data: membershipStatus } = useUserCommunityMembership(communityId);
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedFolder, setSelectedFolder] = useState<ResourceFolder | null>(null);

  // Query resource folders
  const { data: folders, isLoading: isLoadingFolders } = useResourceFolders(communityId);

  // Query resources for selected folder
  const { data: folderResources, isLoading: isLoadingResources } = useFolderResources(
    communityId,
    selectedFolder?.id || ''
  );

  // Filter and sort folders
  const filteredFolders = folders?.filter(folder => {
    // Filter by membership status - only show folders to approved members
    if (membershipStatus && !['owner', 'moderator', 'approved'].includes(membershipStatus)) {
      return false;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return folder.name.toLowerCase().includes(query) ||
             folder.description?.toLowerCase().includes(query) ||
             folder.tags.some(tag => tag.toLowerCase().includes(query));
    }
    if (selectedTag !== 'all') {
      return folder.tags.includes(selectedTag);
    }
    return true;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'resources':
        return b.resourceCount - a.resourceCount;
      case 'oldest':
        return a.createdAt - b.createdAt;
      case 'newest':
      default:
        return b.createdAt - a.createdAt;
    }
  }) || [];

  // Get unique tags from folders
  const tags = Array.from(new Set(folders?.flatMap(folder => folder.tags) || []));

  // Calculate permissions for all folders
  const folderPermissions = filteredFolders.reduce((acc, folder) => {
    if (!user) {
      acc[folder.id] = false;
      return acc;
    }

    // Check permission based on folder settings
    switch (folder.addPermission) {
      case 'admins':
        acc[folder.id] = role === 'owner';
        break;
      case 'moderators':
        acc[folder.id] = role === 'owner' || role === 'moderator';
        break;
      case 'members':
        acc[folder.id] = true;
        break;
      default:
        acc[folder.id] = false;
    }
    return acc;
  }, {} as Record<string, boolean>);

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'url':
        return <Globe className="w-4 h-4" />;
      case 'note':
        return <FileText className="w-4 h-4" />;
      case 'article':
        return <BookOpen className="w-4 h-4" />;
      default:
        return <Globe className="w-4 h-4" />;
    }
  };

  const getPermissionIcon = (permission: string) => {
    switch (permission) {
      case 'admins':
        return <Crown className="w-3 h-3" />;
      case 'moderators':
        return <Shield className="w-3 h-3" />;
      case 'members':
        return <Users className="w-3 h-3" />;
      default:
        return <Users className="w-3 h-3" />;
    }
  };

  const getPermissionLabel = (permission: string) => {
    switch (permission) {
      case 'admins':
        return 'Admins Only';
      case 'moderators':
        return 'Admins + Mods';
      case 'members':
        return 'Any Member';
      default:
        return 'Any Member';
    }
  };

  // Calculate permission for selected folder
  const canAddToSelectedFolder = selectedFolder && user ? (() => {
    switch (selectedFolder.addPermission) {
      case 'admins':
        return role === 'owner';
      case 'moderators':
        return role === 'owner' || role === 'moderator';
      case 'members':
        return true;
      default:
        return false;
    }
  })() : false;

  // Show folder view if a folder is selected
  if (selectedFolder) {
    // Check if user is approved to view folder contents
    if (membershipStatus && !['owner', 'moderator', 'approved'].includes(membershipStatus)) {
      return (
        <div className="flex-1 bg-background text-foreground flex flex-col h-full">
          <div className="border-b border-border p-4 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFolder(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ← Back to Folders
              </Button>
              <div className="flex items-center space-x-2">
                <Folder className="w-5 h-5 text-nostr-purple" />
                <div>
                  <h1 className="text-xl font-semibold text-foreground">{selectedFolder.name}</h1>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <span>{selectedFolder.resourceCount} resources</span>
                    <span>•</span>
                    <div className="flex items-center space-x-1">
                      {getPermissionIcon(selectedFolder.addPermission)}
                      <span>{getPermissionLabel(selectedFolder.addPermission)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-8">
            <MembershipCTA
              _communityId={communityId}
              onJoinRequest={() => {
                toast({
                  title: "Feature Coming Soon",
                  description: "Join requests will be available soon. Please contact a community moderator.",
                });
              }}
              className="max-w-md"
            />
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 bg-background text-foreground flex flex-col h-full">
        {/* Folder Header */}
        <div className="border-b border-border p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFolder(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ← Back to Folders
              </Button>
              <div className="flex items-center space-x-2">
                <Folder className="w-5 h-5 text-nostr-purple" />
                <div>
                  <h1 className="text-xl font-semibold text-foreground">{selectedFolder.name}</h1>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <span>{selectedFolder.resourceCount} resources</span>
                    <span>•</span>
                    <div className="flex items-center space-x-1">
                      {getPermissionIcon(selectedFolder.addPermission)}
                      <span>{getPermissionLabel(selectedFolder.addPermission)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {canAddToSelectedFolder && (
              <AddResourceToFolderDialog
                communityId={communityId}
                folderId={selectedFolder.id}
                folderName={selectedFolder.name}
              />
            )}
          </div>
          {selectedFolder.description && (
            <p className="text-muted-foreground mt-2">{selectedFolder.description}</p>
          )}
        </div>

        {/* Folder Resources */}
        <div className="flex-1 overflow-y-auto spaces-scroll">
          <div className="p-4">
            {isLoadingResources ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <Skeleton className="w-8 h-8 bg-muted" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4 bg-muted" />
                          <Skeleton className="h-3 w-1/2 bg-muted" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : folderResources && folderResources.length > 0 ? (
              <div className="space-y-3">
                {folderResources.map((resource) => (
                  <FolderResourceCard key={resource.id} resource={resource} getResourceIcon={getResourceIcon} />
                ))}
              </div>
            ) : (
              <Card className="border-dashed border-border bg-card">
                <CardContent className="py-12 px-8 text-center">
                  <Folder className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2 text-card-foreground">No resources yet</h3>
                  <p className="text-muted-foreground mb-4">
                    This folder is empty. Be the first to add a resource!
                  </p>
                  {canAddToSelectedFolder && (
                    <AddResourceToFolderDialog
                      communityId={communityId}
                      folderId={selectedFolder.id}
                      folderName={selectedFolder.name}
                      trigger={
                        <Button className="bg-nostr-purple hover:bg-nostr-purple/80 text-nostr-purple-foreground">
                          <Plus className="w-4 h-4 mr-2" />
                          Add First Resource
                        </Button>
                      }
                    />
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isLoadingFolders) {
    return (
      <div className="flex-1 bg-background text-foreground flex flex-col h-full">
        <div className="border-b border-border p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48 bg-gray-700" />
            <Skeleton className="h-10 w-32 bg-gray-700" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto spaces-scroll">
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-start space-x-3">
                      <Skeleton className="w-12 h-12 bg-muted" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-3/4 bg-muted" />
                        <Skeleton className="h-4 w-full bg-muted" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Skeleton className="h-4 w-1/2 bg-muted" />
                    <Skeleton className="h-4 w-2/3 bg-muted" />
                    <Skeleton className="h-4 w-1/3 bg-muted" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background text-foreground flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <BookOpen className="w-6 h-6 text-nostr-purple" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">Resource Folders</h1>
              <p className="text-sm text-muted-foreground">
                Organized folders of community resources
              </p>
            </div>
          </div>
          {user && membershipStatus && ['owner', 'moderator', 'approved'].includes(membershipStatus) && (role === 'owner' || role === 'moderator') && (
            <CreateResourceFolderDialog communityId={communityId} />
          )}
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto spaces-scroll">
        <div className="p-4 space-y-4">

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-input border-border text-foreground placeholder-muted-foreground focus:border-nostr-purple"
            />
          </div>
          <Select value={selectedTag} onValueChange={setSelectedTag}>
            <SelectTrigger className="w-48 bg-input border-border text-foreground">
              <SelectValue placeholder="Filter by tag" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Tags</SelectItem>
              {tags.map(tag => (
                <SelectItem key={tag} value={tag}>
                  #{tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48 bg-input border-border text-foreground">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="name">Name A-Z</SelectItem>
              <SelectItem value="resources">Most Resources</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex border border-border rounded-md overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('grid')}
              className={`rounded-none border-r border-border ${
                viewMode === 'grid' 
                  ? 'bg-nostr-purple/20 text-nostr-purple hover:bg-nostr-purple/30' 
                  : 'hover:bg-accent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('list')}
              className={`rounded-none ${
                viewMode === 'list' 
                  ? 'bg-nostr-purple/20 text-nostr-purple hover:bg-nostr-purple/30' 
                  : 'hover:bg-accent text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Results */}
        {filteredFolders.length === 0 ? (
          membershipStatus && ['owner', 'moderator', 'approved'].includes(membershipStatus) ? (
            <Card className="border-dashed border-border bg-card">
              <CardContent className="py-12 px-8 text-center">
                <Folder className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-card-foreground">No resource folders found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || selectedTag !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Create the first resource folder for this community!'
                  }
                </p>
                {user && (role === 'owner' || role === 'moderator') && (
                  <CreateResourceFolderDialog
                    communityId={communityId}
                    trigger={
                      <Button className="bg-nostr-purple hover:bg-nostr-purple/80 text-nostr-purple-foreground">
                        <Plus className="w-4 h-4 mr-2" />
                        Create First Folder
                      </Button>
                    }
                  />
                )}
              </CardContent>
            </Card>
          ) : (
            <MembershipCTA
              _communityId={communityId}
              onJoinRequest={() => {
                toast({
                  title: "Feature Coming Soon",
                  description: "Join requests will be available soon. Please contact a community moderator.",
                });
              }}
              className="border-dashed border-border bg-card"
            />
          )
        ) : (
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'space-y-3'
          } style={{ willChange: 'scroll-position' }}>
            {filteredFolders.map((folder) => (
              <ResourceFolderCard
                key={folder.id}
                folder={folder}
                viewMode={viewMode}
                onFolderClick={setSelectedFolder}
                communityId={communityId}
                getPermissionIcon={getPermissionIcon}
                getPermissionLabel={getPermissionLabel}
                canAddToFolder={folderPermissions[folder.id] || false}
                isApprovedMember={membershipStatus ? ['owner', 'moderator', 'approved'].includes(membershipStatus) : false}
              />
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function ResourceFolderCard({
  folder,
  viewMode,
  onFolderClick,
  communityId,
  getPermissionIcon,
  getPermissionLabel,
  canAddToFolder,
  isApprovedMember
}: {
  folder: ResourceFolder;
  viewMode: 'grid' | 'list';
  onFolderClick: (folder: ResourceFolder) => void;
  communityId: string;
  getPermissionIcon: (permission: string) => React.ReactNode;
  getPermissionLabel: (permission: string) => string;
  canAddToFolder: boolean;
  isApprovedMember: boolean;
}) {
  const timeAgo = new Date(folder.createdAt * 1000).toLocaleDateString();

  if (viewMode === 'list') {
    return (
      <Card className="bg-card border-border hover:bg-accent/50 transition-colors">
        <CardContent className="p-4">
          <div className="flex space-x-4">
            <div
              className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => onFolderClick(folder)}
            >
              {folder.image ? (
                <img
                  src={folder.image}
                  alt={folder.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <Folder className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3
                      className="font-semibold text-lg text-card-foreground cursor-pointer hover:text-nostr-purple transition-colors"
                      onClick={() => onFolderClick(folder)}
                    >
                      {folder.name}
                    </h3>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-sm line-clamp-2">
                    {folder.description}
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
                  <Badge variant="secondary" className="bg-muted text-card-foreground">
                    {folder.resourceCount} resources
                  </Badge>
                  <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                    {getPermissionIcon(folder.addPermission)}
                    <span>{getPermissionLabel(folder.addPermission)}</span>
                  </div>
                  {folder.tags.slice(0, 2).map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs border-border text-card-foreground">
                      #{tag}
                    </Badge>
                  ))}
                  {folder.tags.length > 2 && (
                    <Badge variant="outline" className="text-xs border-border text-card-foreground">
                      +{folder.tags.length - 2}
                    </Badge>
                  )}
                </div>
                {canAddToFolder && isApprovedMember && (
                  <AddResourceToFolderDialog
                    communityId={communityId}
                    folderId={folder.id}
                    folderName={folder.name}
                  />
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border hover:bg-accent/50 transition-colors">
      <CardHeader>
        <div className="flex items-start space-x-3">
          <div
            className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors"
            onClick={() => onFolderClick(folder)}
          >
            {folder.image ? (
              <img
                src={folder.image}
                alt={folder.name}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <Folder className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <CardTitle
                className="text-lg line-clamp-1 text-card-foreground cursor-pointer hover:text-nostr-purple transition-colors"
                onClick={() => onFolderClick(folder)}
              >
                {folder.name}
              </CardTitle>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm line-clamp-2 mt-1">
              {folder.description}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="bg-muted text-card-foreground">
            {folder.resourceCount} resources
          </Badge>
          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>{timeAgo}</span>
          </div>
        </div>

        {/* Permission indicator */}
        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
          {getPermissionIcon(folder.addPermission)}
          <span>{getPermissionLabel(folder.addPermission)}</span>
        </div>

        {/* Tags */}
        {folder.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {folder.tags.slice(0, 3).map(tag => (
              <Badge key={tag} variant="outline" className="text-xs border-border text-card-foreground">
                #{tag}
              </Badge>
            ))}
            {folder.tags.length > 3 && (
              <Badge variant="outline" className="text-xs border-border text-card-foreground">
                +{folder.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Add Resource Button */}
        {canAddToFolder && isApprovedMember && (
          <div className="pt-2 border-t border-border">
            <AddResourceToFolderDialog
              communityId={communityId}
              folderId={folder.id}
              folderName={folder.name}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FolderResourceCard({
  resource,
  getResourceIcon
}: {
  resource: FolderResource;
  getResourceIcon: (type: string) => React.ReactNode;
}) {
  const timeAgo = new Date(resource.createdAt * 1000).toLocaleDateString();

  const handleResourceClick = () => {
    if (resource.type === 'url' && resource.url) {
      window.open(resource.url, '_blank', 'noopener,noreferrer');
    }
    // For note and article types, we could implement navigation to the Nostr content
  };

  return (
    <Card
      className="bg-card border-border hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={handleResourceClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <div className="text-muted-foreground mt-1">
            {getResourceIcon(resource.type)}
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-card-foreground hover:text-nostr-purple transition-colors">
              {resource.title}
            </h4>
            {resource.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {resource.description}
              </p>
            )}
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <span className="capitalize">{resource.type}</span>
                {resource.type === 'url' && resource.url && (
                  <>
                    <span>•</span>
                    <span>{new URL(resource.url).hostname}</span>
                  </>
                )}
              </div>
              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>{timeAgo}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}