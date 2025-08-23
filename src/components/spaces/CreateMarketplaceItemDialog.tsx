import { useState } from 'react';
import { Plus, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useUploadFile } from '@/hooks/useUploadFile';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useQueryClient } from '@tanstack/react-query';

interface CreateMarketplaceItemDialogProps {
  communityId: string;
  trigger?: React.ReactNode;
}

interface MarketplaceItemData {
  name: string;
  description: string;
  price: string;
  currency: string;
  category: string;
  condition: 'new' | 'used' | 'refurbished';
  location: string;
  images: string[];
}

const CATEGORIES = [
  'electronics',
  'clothing',
  'books',
  'tools',
  'furniture',
  'vehicles',
  'sports',
  'music',
  'art',
  'food',
  'services',
  'other'
];

const CURRENCIES = [
  { value: 'sats', label: 'Satoshis (sats)' },
  { value: 'btc', label: 'Bitcoin (BTC)' },
  { value: 'usd', label: 'US Dollar (USD)' },
  { value: 'eur', label: 'Euro (EUR)' },
];

export function CreateMarketplaceItemDialog({ communityId, trigger }: CreateMarketplaceItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MarketplaceItemData>({
    name: '',
    description: '',
    price: '',
    currency: 'sats',
    category: '',
    condition: 'used',
    location: '',
    images: [],
  });

  const { user } = useCurrentUser();
  const { mutate: createEvent, isPending: isPublishing } = useNostrPublish();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to list an item.",
        variant: "destructive",
      });
      return;
    }

    if (!data.name.trim() || !data.price.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide at least a name and price for your item.",
        variant: "destructive",
      });
      return;
    }

    const price = parseFloat(data.price);
    if (isNaN(price) || price <= 0) {
      toast({
        title: "Invalid price",
        description: "Please enter a valid price greater than 0.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Generate a unique identifier for this product
      const productId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create the product content according to NIP-15
      const content = JSON.stringify({
        id: productId,
        name: data.name.trim(),
        description: data.description.trim(),
        price: price,
        currency: data.currency,
        images: data.images,
        condition: data.condition,
        location: data.location.trim() || undefined,
      });

      // Create tags for the event
      const tags = [
        ['d', productId], // Required d tag with product ID
        ['a', communityId], // Community reference
      ];

      // Add category tag if specified
      if (data.category) {
        tags.push(['t', data.category]);
      }

      // Create the NIP-15 product event (kind 30018)
      createEvent({
        kind: 30018,
        content,
        tags,
      }, {
        onSuccess: () => {
          toast({
            title: "Item listed successfully!",
            description: "Your item has been added to the community marketplace.",
          });

          // Invalidate marketplace items query to refresh the list
          queryClient.invalidateQueries({
            queryKey: ['marketplace-items', communityId],
          });

          setOpen(false);
          // Reset form
          setData({
            name: '',
            description: '',
            price: '',
            currency: 'sats',
            category: '',
            condition: 'used',
            location: '',
            images: [],
          });
        },
        onError: (error) => {
          toast({
            title: "Failed to list item",
            description: error.message || "An error occurred while listing your item.",
            variant: "destructive",
          });
        },
      });
    } catch {
      toast({
        title: "Failed to list item",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    try {
      const [[_, url]] = await uploadFile(file);
      setData(prev => ({
        ...prev,
        images: [...prev.images, url],
      }));
      toast({
        title: "Image uploaded",
        description: "Your image has been uploaded successfully.",
      });
    } catch {
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const removeImage = (index: number) => {
    setData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const defaultTrigger = (
    <Button className="bg-nostr-purple hover:bg-nostr-purple/80 text-nostr-purple-foreground">
      <Plus className="w-4 h-4 mr-2" />
      List Item
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            List Item in Community Marketplace
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-foreground">Item Name *</Label>
              <Input
                id="name"
                value={data.name}
                onChange={(e) => setData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter item name"
                className="bg-input border-border text-foreground placeholder-muted-foreground"
                required
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-foreground">Description</Label>
              <Textarea
                id="description"
                value={data.description}
                onChange={(e) => setData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your item..."
                rows={3}
                className="bg-input border-border text-foreground placeholder-muted-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price" className="text-foreground">Price *</Label>
                <Input
                  id="price"
                  type="number"
                  step="any"
                  min="0"
                  value={data.price}
                  onChange={(e) => setData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00"
                  className="bg-input border-border text-foreground placeholder-muted-foreground"
                  required
                />
              </div>

              <div>
                <Label htmlFor="currency" className="text-foreground">Currency</Label>
                <Select value={data.currency} onValueChange={(value) => setData(prev => ({ ...prev, currency: value }))}>
                  <SelectTrigger className="bg-input border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {CURRENCIES.map(currency => (
                      <SelectItem key={currency.value} value={currency.value}>
                        {currency.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category" className="text-foreground">Category</Label>
                <Select value={data.category} onValueChange={(value) => setData(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger className="bg-input border-border text-foreground">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {CATEGORIES.map(category => (
                      <SelectItem key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="condition" className="text-foreground">Condition</Label>
                <Select value={data.condition} onValueChange={(value: 'new' | 'used' | 'refurbished') => setData(prev => ({ ...prev, condition: value }))}>
                  <SelectTrigger className="bg-input border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="used">Used</SelectItem>
                    <SelectItem value="refurbished">Refurbished</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="location" className="text-foreground">Location</Label>
              <Input
                id="location"
                value={data.location}
                onChange={(e) => setData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="City, State/Country"
                className="bg-input border-border text-foreground placeholder-muted-foreground"
              />
            </div>
          </div>

          {/* Images */}
          <div className="space-y-4">
            <Label className="text-foreground">Images</Label>

            {/* Image Upload */}
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
                disabled={isUploading}
              />
              <label
                htmlFor="image-upload"
                className="flex items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-muted-foreground transition-colors"
              >
                <div className="text-center">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">
                    {isUploading ? 'Uploading...' : 'Click to upload image'}
                  </p>
                  <p className="text-xs text-muted-foreground">Max 5MB, JPG/PNG</p>
                </div>
              </label>
            </div>

            {/* Image Preview */}
            {data.images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {data.images.map((url, index) => (
                  <Card key={index} className="relative bg-card border-border">
                    <CardContent className="p-2">
                      <img
                        src={url}
                        alt={`Product image ${index + 1}`}
                        className="w-full h-24 object-cover rounded"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-1 right-1 h-6 w-6 p-0"
                        onClick={() => removeImage(index)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-border text-muted-foreground hover:bg-accent"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPublishing || isUploading || !user}
              className="bg-nostr-purple hover:bg-nostr-purple/80 text-nostr-purple-foreground"
            >
              {isPublishing ? 'Listing...' : 'List Item'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}