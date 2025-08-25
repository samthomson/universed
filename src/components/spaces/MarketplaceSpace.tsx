import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useNavigate } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useMarketplaceContext } from '@/contexts/MarketplaceContext.tsx';
// import { createMarketplaceItemMessage } from '@/lib/marketplaceDM';
import {
  ShoppingBag,
  Plus,
  Search,
  Grid3X3,
  List,
  Bitcoin,
  Zap,
  DollarSign,
  MapPin,
  Clock,
  MessageCircle,
  Copy,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { useToast } from '@/hooks/useToast';
import { useUserCommunityMembership } from '@/hooks/useUserCommunityMembership';
import { MembershipCTA } from '@/components/community/MembershipCTA';
import { genUserName } from '@/lib/genUserName';
import { CreateMarketplaceItemDialog } from './CreateMarketplaceItemDialog';
import type { NostrEvent } from '@nostrify/nostrify';

interface MarketplaceSpaceProps {
  communityId: string;
  onNavigateToDMs?: (targetPubkey?: string, item?: MarketplaceItem) => void;
}

export interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  seller: string;
  location?: string;
  category: string;
  condition: 'new' | 'used' | 'refurbished';
  createdAt: number;
  event: NostrEvent;
  communityId: string;
}

// Validate NIP-15 marketplace events
function validateMarketplaceEvent(event: NostrEvent, expectedCommunityId: string): boolean {
  if (![30017, 30018].includes(event.kind)) return false;

  // Check if the event belongs to the expected community
  const communityTag = event.tags.find(([name]) => name === 'a')?.[1];
  if (!communityTag || communityTag !== expectedCommunityId) {
    return false;
  }

  try {
    const content = JSON.parse(event.content);
    if (event.kind === 30018 && (!content.name || !content.price)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function parseMarketplaceEvent(event: NostrEvent): MarketplaceItem | null {
  if (event.kind !== 30018) return null; // Only parse product events

  try {
    const content = JSON.parse(event.content);
    const d = event.tags.find(([name]) => name === 'd')?.[1] || '';
    const category = event.tags.find(([name]) => name === 't')?.[1] || 'general';
    const communityTag = event.tags.find(([name]) => name === 'a')?.[1] || '';

    return {
      id: d,
      name: content.name,
      description: content.description || '',
      price: content.price,
      currency: content.currency || 'sats',
      images: content.images || [],
      seller: event.pubkey,
      location: content.location,
      category,
      condition: content.condition || 'used',
      createdAt: event.created_at,
      event,
      communityId: communityTag,
    };
  } catch {
    return null;
  }
}

export function MarketplaceSpace({ communityId, onNavigateToDMs }: MarketplaceSpaceProps) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const { highlightedItemId, clearHighlight } = useMarketplaceContext();
  const highlightedItemRef = useRef<HTMLDivElement>(null);
  const { data: membershipStatus } = useUserCommunityMembership(communityId);
  const { toast } = useToast();

  // Effect to scroll to highlighted item
  useEffect(() => {
    if (highlightedItemId && highlightedItemRef.current) {
      // Scroll the highlighted item into view
      highlightedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });

      // Add a highlight animation
      const element = highlightedItemRef.current;
      element.classList.add('ring-2', 'ring-nostr-purple', 'ring-opacity-75');

      // Remove the highlight after 3 seconds
      const timer = setTimeout(() => {
        element.classList.remove('ring-2', 'ring-nostr-purple', 'ring-opacity-75');
        clearHighlight();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [highlightedItemId, clearHighlight]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('newest');

  // Query marketplace items (NIP-15 products) - fetch once for the community
  const { data: allItems, isLoading } = useQuery({
    queryKey: ['marketplace-items', communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(2000)]); // BRUTAL: 2s max for marketplace

      // Parse community ID to get the components for filtering
      const [kind, pubkey, identifier] = communityId.split(':');

      if (!kind || !pubkey || !identifier) {
        return [];
      }

      // Query for NIP-15 product events that belong to this community
      const events = await nostr.query([
        {
          kinds: [30018], // NIP-15 product events
          '#a': [`${kind}:${pubkey}:${identifier}`], // Filter by community
          limit: 100,
        }
      ], { signal });

      const validEvents = events.filter(event => validateMarketplaceEvent(event, `${kind}:${pubkey}:${identifier}`));
      const items = validEvents
        .map(parseMarketplaceEvent)
        .filter((item): item is MarketplaceItem => item !== null);

      return items;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Filter and sort items locally based on search and filters
  const items = useMemo(() => {
    if (!allItems) return [];

    let filteredItems = allItems;

    // Filter by membership status - only show items from approved members
    if (membershipStatus && ['owner', 'moderator', 'approved'].includes(membershipStatus)) {
      // User is approved, show all items
    } else {
      // User is not approved, don't show any items
      return [];
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filteredItems = filteredItems.filter(item => item.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredItems = filteredItems.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
      );
    }

    // Sort items
    filteredItems.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'oldest':
          return a.createdAt - b.createdAt;
        case 'newest':
        default:
          return b.createdAt - a.createdAt;
      }
    });

    return filteredItems;
  }, [allItems, selectedCategory, searchQuery, sortBy, membershipStatus]);

  // Get unique categories from all items
  const categories = useMemo(() =>
    Array.from(new Set(allItems?.map(item => item.category) || [])),
    [allItems]
  );

  const formatPrice = (price: number, currency: string) => {
    if (currency === 'sats') {
      return `${price.toLocaleString()} sats`;
    }
    if (currency === 'btc') {
      return `₿${price}`;
    }
    return `${price} ${currency.toUpperCase()}`;
  };

  const getCurrencyIcon = (currency: string) => {
    switch (currency.toLowerCase()) {
      case 'btc':
        return <Bitcoin className="w-4 h-4" />;
      case 'sats':
        return <Zap className="w-4 h-4" />;
      default:
        return <DollarSign className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 bg-background text-foreground flex flex-col h-full">
        <div className="border-b border-border p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto spaces-scroll">
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="bg-card border-border">
                  <CardHeader className="p-0">
                    <Skeleton className="aspect-square w-full" />
                  </CardHeader>
                  <CardContent className="p-3 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-5 w-1/3" />
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
            <ShoppingBag className="w-6 h-6 text-nostr-purple" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">Marketplace</h1>
              <p className="text-sm text-muted-foreground">
                Community marketplace for Bitcoin, Lightning, and Cashu
              </p>
            </div>
          </div>
          {user && membershipStatus && ['owner', 'moderator', 'approved'].includes(membershipStatus) && (
            <CreateMarketplaceItemDialog communityId={communityId} />
          )}
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin"
           style={{ maxHeight: 'calc(100vh - 200px)' }}>
        <div className="p-4 space-y-4">

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search marketplace..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-input border-border text-foreground placeholder-muted-foreground focus:border-nostr-purple"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48 bg-input border-border text-foreground">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
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
              <SelectItem value="price-low">Price: Low to High</SelectItem>
              <SelectItem value="price-high">Price: High to Low</SelectItem>
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
        {items && items.length === 0 ? (
          membershipStatus && ['owner', 'moderator', 'approved'].includes(membershipStatus) ? (
            <Card className="border-dashed border-border bg-card">
              <CardContent className="py-12 px-8 text-center">
                <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-foreground">No items found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || selectedCategory !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Be the first to list an item in this community marketplace!'
                  }
                </p>
                {user && (
                  <CreateMarketplaceItemDialog
                    communityId={communityId}
                    trigger={
                      <Button className="bg-nostr-purple hover:bg-nostr-purple/80 text-nostr-purple-foreground">
                        <Plus className="w-4 h-4 mr-2" />
                        List First Community Item
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
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'space-y-3'
          } style={{ willChange: 'scroll-position' }}>
            {items?.map((item) => (
              <div
                key={item.id}
                ref={item.id === highlightedItemId ? highlightedItemRef : null}
                className={item.id === highlightedItemId ? 'scroll-mt-24' : ''}
              >
                <MarketplaceItemCard
                  item={item}
                  viewMode={viewMode}
                  formatPrice={formatPrice}
                  getCurrencyIcon={getCurrencyIcon}
                  isHighlighted={item.id === highlightedItemId}
                  onStartDM={(pubkey, item) => {
                    if (onNavigateToDMs) {
                      // Use the proper navigation function that clears community state and includes item data
                      onNavigateToDMs(pubkey, item);
                    } else {
                      // Fallback to direct navigation
                      const npub = nip19.npubEncode(pubkey);
                      navigate(`/dm/${npub}`);
                    }
                  }}
                />
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function MarketplaceItemCard({
  item,
  viewMode,
  formatPrice,
  getCurrencyIcon,
  isHighlighted,
  onStartDM
}: {
  item: MarketplaceItem;
  viewMode: 'grid' | 'list';
  formatPrice: (price: number, currency: string) => string;
  getCurrencyIcon: (currency: string) => React.ReactNode;
  isHighlighted?: boolean;
  onStartDM: (pubkey: string, item: MarketplaceItem) => void;
}) {
  const [copiedNpub, setCopiedNpub] = useState(false);
  const { toast } = useToast();

  const timeAgo = new Date(item.createdAt * 1000).toLocaleDateString();
  const author = useAuthor(item.seller);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || genUserName(item.seller);
  const profileImage = metadata?.picture;

  // Generate npub for display and copying
  const npub = nip19.npubEncode(item.seller);
  const shortNpub = `${npub.slice(0, 8)}...${npub.slice(-4)}`;

  const handleCopyNpub = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(npub);
      setCopiedNpub(true);
      toast({
        title: "Copied!",
        description: "User's npub copied to clipboard",
      });
      setTimeout(() => setCopiedNpub(false), 2000);
    } catch {
      toast({
        title: "Failed to copy",
        description: "Could not copy npub to clipboard",
        variant: "destructive",
      });
    }
  };

  if (viewMode === 'list') {
    return (
      <Card className={`bg-card border-border hover:bg-accent/50 transition-colors cursor-pointer ${isHighlighted ? 'ring-2 ring-nostr-purple ring-opacity-75' : ''}`}>
        <CardContent className="p-4">
          <div className="flex space-x-4">
            <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center">
              {item.images.length > 0 ? (
                <img
                  src={item.images[0]}
                  alt={item.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <ShoppingBag className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-card-foreground">{item.name}</h3>
                  <p className="text-muted-foreground text-sm line-clamp-2">
                    {item.description}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-1 text-lg font-bold text-green-400">
                    {getCurrencyIcon(item.currency)}
                    <span>{formatPrice(item.price, item.currency)}</span>
                  </div>
                  <Badge variant="secondary" className="mt-1 bg-muted text-card-foreground">
                    {item.condition}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center space-x-4">
                  <Badge variant="outline" className="border-border text-card-foreground">{item.category}</Badge>
                  {item.location && (
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-3 h-3" />
                      <span>{item.location}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{timeAgo}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={profileImage} alt={displayName} />
                      <AvatarFallback className="bg-nostr-purple text-nostr-purple-foreground text-xs">
                        {displayName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-card-foreground text-sm">{displayName}</span>
                      <div className="flex items-center space-x-1">
                        <span className="text-xs text-muted-foreground">{shortNpub}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-4 w-4 p-0 hover:bg-muted"
                          onClick={handleCopyNpub}
                        >
                          {copiedNpub ? (
                            <Check className="w-3 h-3 text-green-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs border-border hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartDM(item.seller, item);
                    }}
                  >
                    <MessageCircle className="w-3 h-3 mr-1" />
                    DM
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-card border-border hover:bg-accent/50 transition-colors cursor-pointer ${isHighlighted ? 'ring-2 ring-nostr-purple ring-opacity-75' : ''}`}>
      <CardHeader className="p-0">
        <div className="aspect-square bg-muted rounded-t-lg flex items-center justify-center">
          {item.images.length > 0 ? (
            <img
              src={item.images[0]}
              alt={item.name}
              className="w-full h-full object-cover rounded-t-lg"
            />
          ) : (
            <ShoppingBag className="w-12 h-12 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        <div>
          <h3 className="font-semibold line-clamp-1 text-card-foreground">{item.name}</h3>
          <p className="text-muted-foreground text-sm line-clamp-2">
            {item.description}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1 font-bold text-green-400">
            {getCurrencyIcon(item.currency)}
            <span>{formatPrice(item.price, item.currency)}</span>
          </div>
          <Badge variant="secondary" className="bg-muted text-card-foreground">{item.condition}</Badge>
        </div>

        <div className="flex items-center justify-between text-sm">
          <Badge variant="outline" className="border-border text-card-foreground">{item.category}</Badge>
          <div className="flex items-center space-x-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{timeAgo}</span>
          </div>
        </div>

        {item.location && (
          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span>{item.location}</span>
          </div>
        )}

        {/* Seller Info and DM Button */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <Avatar className="w-6 h-6 flex-shrink-0">
              <AvatarImage src={profileImage} alt={displayName} />
              <AvatarFallback className="bg-nostr-purple text-nostr-purple-foreground text-xs">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-card-foreground text-sm truncate">{displayName}</span>
              <div className="flex items-center space-x-1">
                <span className="text-xs text-muted-foreground truncate">{shortNpub}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-4 w-4 p-0 hover:bg-muted flex-shrink-0"
                  onClick={handleCopyNpub}
                >
                  {copiedNpub ? (
                    <Check className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs border-border hover:bg-muted flex-shrink-0 ml-2"
            onClick={(e) => {
              e.stopPropagation();
              onStartDM(item.seller, item);
            }}
          >
            <MessageCircle className="w-3 h-3 mr-1" />
            DM
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}