import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
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
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { NostrEvent } from '@nostrify/nostrify';

interface MarketplaceSpaceProps {
  communityId: string;
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
function validateMarketplaceEvent(event: NostrEvent): boolean {
  if (![30017, 30018].includes(event.kind)) return false;

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

export function MarketplaceSpace({ communityId }: MarketplaceSpaceProps) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('newest');

  // Query marketplace items (NIP-15 products)
  const { data: items, isLoading } = useQuery({
    queryKey: ['marketplace-items', communityId, searchQuery, selectedCategory, sortBy],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Query for NIP-15 product events
      const events = await nostr.query([
        {
          kinds: [30018], // NIP-15 product events
          '#t': selectedCategory === 'all' ? undefined : [selectedCategory],
          limit: 100,
        }
      ], { signal });

      const validEvents = events.filter(validateMarketplaceEvent);
      const items = validEvents
        .map(parseMarketplaceEvent)
        .filter((item): item is MarketplaceItem => item !== null);

      // Filter by search query
      let filteredItems = items;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredItems = items.filter(item =>
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
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Get unique categories from items
  const categories = Array.from(new Set(items?.map(item => item.category) || []));

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
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-48 w-full" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-6 w-1/3" />
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
          <ShoppingBag className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold">Marketplace</h1>
            <p className="text-muted-foreground">
              Buy and sell goods with Bitcoin, Lightning, and Cashu
            </p>
          </div>
        </div>
        {user && (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            List Item
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search marketplace..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(category => (
              <SelectItem key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
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
            <SelectItem value="price-low">Price: Low to High</SelectItem>
            <SelectItem value="price-high">Price: High to Low</SelectItem>
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
      {items && items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center">
            <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No items found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || selectedCategory !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Be the first to list an item in this marketplace!'
              }
            </p>
            {user && (
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                List Your First Item
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'space-y-4'
        }>
          {items?.map((item) => (
            <MarketplaceItemCard
              key={item.id}
              item={item}
              viewMode={viewMode}
              formatPrice={formatPrice}
              getCurrencyIcon={getCurrencyIcon}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MarketplaceItemCard({
  item,
  viewMode,
  formatPrice,
  getCurrencyIcon
}: {
  item: MarketplaceItem;
  viewMode: 'grid' | 'list';
  formatPrice: (price: number, currency: string) => string;
  getCurrencyIcon: (currency: string) => React.ReactNode;
}) {
  const timeAgo = new Date(item.createdAt * 1000).toLocaleDateString();

  if (viewMode === 'list') {
    return (
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex space-x-4">
            <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center">
              {item.images.length > 0 ? (
                <img
                  src={item.images[0]}
                  alt={item.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <ShoppingBag className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{item.name}</h3>
                  <p className="text-muted-foreground text-sm line-clamp-2">
                    {item.description}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-1 text-lg font-bold">
                    {getCurrencyIcon(item.currency)}
                    <span>{formatPrice(item.price, item.currency)}</span>
                  </div>
                  <Badge variant="secondary" className="mt-1">
                    {item.condition}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center space-x-4">
                  <Badge variant="outline">{item.category}</Badge>
                  {item.location && (
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-3 h-3" />
                      <span>{item.location}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>{timeAgo}</span>
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
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold line-clamp-1">{item.name}</h3>
          <p className="text-muted-foreground text-sm line-clamp-2">
            {item.description}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1 font-bold">
            {getCurrencyIcon(item.currency)}
            <span>{formatPrice(item.price, item.currency)}</span>
          </div>
          <Badge variant="secondary">{item.condition}</Badge>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <Badge variant="outline">{item.category}</Badge>
          <div className="flex items-center space-x-1">
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
      </CardContent>
    </Card>
  );
}