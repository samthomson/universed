import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useNavigate } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
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
import { genUserName } from '@/lib/genUserName';
import { CreateMarketplaceItemDialog } from './CreateMarketplaceItemDialog';
import type { NostrEvent } from '@nostrify/nostrify';

interface MarketplaceSpaceProps {
  communityId: string;
  onNavigateToDMs?: (targetPubkey?: string) => void;
}

interface MarketplaceItem {
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
    };
  } catch {
    return null;
  }
}

export function MarketplaceSpace({ communityId, onNavigateToDMs }: MarketplaceSpaceProps) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const navigate = useNavigate();
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
  }, [allItems, selectedCategory, searchQuery, sortBy]);

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
      <div className="flex-1 bg-gray-800 text-gray-100 flex flex-col h-full">
        <div className="border-b border-gray-700 p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48 bg-gray-700" />
            <Skeleton className="h-10 w-32 bg-gray-700" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto spaces-scroll">
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="bg-gray-750 border-gray-600">
                  <CardHeader className="p-0">
                    <Skeleton className="aspect-square w-full bg-gray-600" />
                  </CardHeader>
                  <CardContent className="p-3 space-y-2">
                    <Skeleton className="h-4 w-3/4 bg-gray-600" />
                    <Skeleton className="h-3 w-1/2 bg-gray-600" />
                    <Skeleton className="h-5 w-1/3 bg-gray-600" />
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
    <div className="flex-1 bg-gray-800 text-gray-100 flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-700 p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ShoppingBag className="w-6 h-6 text-blue-400" />
            <div>
              <h1 className="text-xl font-semibold text-white">Marketplace</h1>
              <p className="text-sm text-gray-400">
                Community marketplace for Bitcoin, Lightning, and Cashu
              </p>
            </div>
          </div>
          {user && (
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search marketplace..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400 focus:border-blue-500"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48 bg-gray-700 border-gray-600 text-gray-100">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="bg-gray-700 border-gray-600">
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48 bg-gray-700 border-gray-600 text-gray-100">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-gray-700 border-gray-600">
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="price-low">Price: Low to High</SelectItem>
              <SelectItem value="price-high">Price: High to Low</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex border border-gray-600 rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className={`rounded-r-none ${viewMode === 'grid' ? 'bg-blue-600 hover:bg-blue-700' : 'hover:bg-gray-600'}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className={`rounded-l-none ${viewMode === 'list' ? 'bg-blue-600 hover:bg-blue-700' : 'hover:bg-gray-600'}`}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Results */}
        {items && items.length === 0 ? (
          <Card className="border-dashed border-gray-600 bg-gray-750">
            <CardContent className="py-12 px-8 text-center">
              <ShoppingBag className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-gray-200">No items found</h3>
              <p className="text-gray-400 mb-4">
                {searchQuery || selectedCategory !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Be the first to list an item in this community marketplace!'
                }
              </p>
              {user && (
                <CreateMarketplaceItemDialog
                  communityId={communityId}
                  trigger={
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Plus className="w-4 h-4 mr-2" />
                      List First Community Item
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>
        ) : (
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'space-y-3'
          } style={{ willChange: 'scroll-position' }}>
            {items?.map((item) => (
              <MarketplaceItemCard
                key={item.id}
                item={item}
                viewMode={viewMode}
                formatPrice={formatPrice}
                getCurrencyIcon={getCurrencyIcon}
                onStartDM={(pubkey) => {
                  if (onNavigateToDMs) {
                    // Use the proper navigation function that handles mobile state correctly
                    onNavigateToDMs(pubkey);
                  } else {
                    // Fallback to direct navigation
                    const npub = nip19.npubEncode(pubkey);
                    navigate(`/dm/${npub}`);
                  }
                }}
              />
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
  onStartDM
}: {
  item: MarketplaceItem;
  viewMode: 'grid' | 'list';
  formatPrice: (price: number, currency: string) => string;
  getCurrencyIcon: (currency: string) => React.ReactNode;
  onStartDM: (pubkey: string) => void;
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
      <Card className="bg-gray-750 border-gray-600 hover:bg-gray-700 transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex space-x-4">
            <div className="w-20 h-20 bg-gray-600 rounded-lg flex items-center justify-center">
              {item.images.length > 0 ? (
                <img
                  src={item.images[0]}
                  alt={item.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <ShoppingBag className="w-6 h-6 text-gray-400" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-100">{item.name}</h3>
                  <p className="text-gray-400 text-sm line-clamp-2">
                    {item.description}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-1 text-lg font-bold text-green-400">
                    {getCurrencyIcon(item.currency)}
                    <span>{formatPrice(item.price, item.currency)}</span>
                  </div>
                  <Badge variant="secondary" className="mt-1 bg-gray-600 text-gray-200">
                    {item.condition}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-400">
                <div className="flex items-center space-x-4">
                  <Badge variant="outline" className="border-gray-500 text-gray-300">{item.category}</Badge>
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
                      <AvatarFallback className="bg-indigo-600 text-white text-xs">
                        {displayName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-gray-300 text-sm">{displayName}</span>
                      <div className="flex items-center space-x-1">
                        <span className="text-xs text-gray-500">{shortNpub}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-4 w-4 p-0 hover:bg-gray-600"
                          onClick={handleCopyNpub}
                        >
                          {copiedNpub ? (
                            <Check className="w-3 h-3 text-green-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-gray-400" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs border-gray-600 hover:bg-gray-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartDM(item.seller);
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
    <Card className="bg-gray-750 border-gray-600 hover:bg-gray-700 transition-colors cursor-pointer">
      <CardHeader className="p-0">
        <div className="aspect-square bg-gray-600 rounded-t-lg flex items-center justify-center">
          {item.images.length > 0 ? (
            <img
              src={item.images[0]}
              alt={item.name}
              className="w-full h-full object-cover rounded-t-lg"
            />
          ) : (
            <ShoppingBag className="w-12 h-12 text-gray-400" />
          )}
        </div>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        <div>
          <h3 className="font-semibold line-clamp-1 text-gray-100">{item.name}</h3>
          <p className="text-gray-400 text-sm line-clamp-2">
            {item.description}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1 font-bold text-green-400">
            {getCurrencyIcon(item.currency)}
            <span>{formatPrice(item.price, item.currency)}</span>
          </div>
          <Badge variant="secondary" className="bg-gray-600 text-gray-200">{item.condition}</Badge>
        </div>

        <div className="flex items-center justify-between text-sm">
          <Badge variant="outline" className="border-gray-500 text-gray-300">{item.category}</Badge>
          <div className="flex items-center space-x-1 text-gray-400">
            <Clock className="w-3 h-3" />
            <span>{timeAgo}</span>
          </div>
        </div>

        {item.location && (
          <div className="flex items-center space-x-1 text-sm text-gray-400">
            <MapPin className="w-3 h-3" />
            <span>{item.location}</span>
          </div>
        )}

        {/* Seller Info and DM Button */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-600">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <Avatar className="w-6 h-6 flex-shrink-0">
              <AvatarImage src={profileImage} alt={displayName} />
              <AvatarFallback className="bg-indigo-600 text-white text-xs">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-gray-300 text-sm truncate">{displayName}</span>
              <div className="flex items-center space-x-1">
                <span className="text-xs text-gray-500 truncate">{shortNpub}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-4 w-4 p-0 hover:bg-gray-600 flex-shrink-0"
                  onClick={handleCopyNpub}
                >
                  {copiedNpub ? (
                    <Check className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-gray-400" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs border-gray-600 hover:bg-gray-600 flex-shrink-0 ml-2"
            onClick={(e) => {
              e.stopPropagation();
              onStartDM(item.seller);
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