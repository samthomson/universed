import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { ShoppingBag, ExternalLink, Copy, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { useToast } from '@/hooks/useToast';
import type { NostrEvent } from '@/types/nostr';

interface MarketplaceItemData {
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

interface CompactMarketplaceItemCardProps {
  item: MarketplaceItemData;
  className?: string;
}

export function CompactMarketplaceItemCard({ item, className }: CompactMarketplaceItemCardProps) {
  const [copiedNpub, setCopiedNpub] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const author = useAuthor(item.seller);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || genUserName(item.seller);
  const profileImage = metadata?.picture;

  // Generate npub for display and copying
  const npub = nip19.npubEncode(item.seller);

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
        return <span className="text-sm">₿</span>;
      case 'sats':
        return <span className="text-sm">⚡</span>;
      default:
        return <span className="text-sm">$</span>;
    }
  };

  const handleCopyNpub = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(npub);
      setCopiedNpub(true);
      toast({
        title: "Copied!",
        description: "Seller's npub copied to clipboard",
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

  const handleViewListing = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Parse the community ID to get the components
    const [kind, pubkey, identifier] = item.communityId.split(':');

    if (!kind || !pubkey || !identifier) {
      toast({
        title: "Error",
        description: "Invalid community ID format",
        variant: "destructive",
      });
      return;
    }

    // Generate naddr for the community
    const communityNaddr = nip19.naddrEncode({
      kind: parseInt(kind),
      pubkey: pubkey,
      identifier: identifier,
      relays: [], // Will use user's preferred relays
    });

    // Navigate to the community with marketplace tab and item highlight
    // We'll use URL parameters to specify the tab and item to highlight
    const url = `/${communityNaddr}?tab=marketplace&highlight=${encodeURIComponent(item.id)}`;

    // Navigate in the same tab
    navigate(url);
  };

  return (
    <Card className={`bg-gray-800 border-gray-700 hover:bg-gray-750 transition-colors ${className}`}>
      <CardContent className="p-3">
        <div className="flex space-x-3">
          {/* Image - Smaller and square */}
          <div className="w-16 h-16 bg-gray-700 rounded-lg flex-shrink-0 flex items-center justify-center">
            {item.images.length > 0 ? (
              <img
                src={item.images[0]}
                alt={item.name}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <ShoppingBag className="w-6 h-6 text-gray-500" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            {/* Title and Price */}
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-gray-100 text-sm truncate flex-1 mr-2">
                {item.name}
              </h3>
              <div className="flex items-center space-x-1 font-bold text-green-400 flex-shrink-0">
                {getCurrencyIcon(item.currency)}
                <span className="text-sm">{formatPrice(item.price, item.currency)}</span>
              </div>
            </div>

            {/* Description - Truncated */}
            <p className="text-gray-400 text-xs line-clamp-1">
              {item.description}
            </p>

            {/* Category and Condition */}
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="border-gray-600 text-gray-300 text-xs px-2 py-0">
                {item.category}
              </Badge>
              <Badge variant="secondary" className="bg-gray-700 text-gray-200 text-xs px-2 py-0">
                {item.condition}
              </Badge>
            </div>

            {/* Seller Info - Compact */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <Avatar className="w-5 h-5 flex-shrink-0">
                  <AvatarImage src={profileImage} alt={displayName} />
                  <AvatarFallback className="bg-indigo-600 text-white text-xs">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-gray-300 text-xs truncate">
                  {displayName}
                </span>
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

              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs border-gray-600 hover:bg-gray-600 flex-shrink-0"
                onClick={handleViewListing}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                View
              </Button>
            </div>
          </div>
        </div>

        {/* Marketplace Badge - Smaller */}
        <div className="flex items-center justify-center mt-2">
          <Badge variant="secondary" className="bg-blue-600/20 text-blue-300 border-blue-600/30 text-xs px-2 py-0">
            <ShoppingBag className="w-3 h-3 mr-1" />
            Marketplace Item
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}