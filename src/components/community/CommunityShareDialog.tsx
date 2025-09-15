import { useState } from 'react';
import { Share2, Copy, Check, ExternalLink, QrCode } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/useToast';
import { generateSpaceUrl } from '@/lib/utils';
import type { CommunityData } from '@/components/DataManagerProvider';
import type { Community } from '@/hooks/useCommunities';
import type { UserCommunity } from '@/hooks/useUserCommunities';

// Union type to accept both DataManager and legacy community types
type ShareableCommunity = CommunityData | Community | UserCommunity;

interface CommunityShareDialogProps {
  community: ShareableCommunity;
  children?: React.ReactNode;
}

export function CommunityShareDialog({ community, children }: CommunityShareDialogProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { toast } = useToast();

  // Helper functions to extract data from different community types
  const getCommunityData = (community: ShareableCommunity) => {
    if ('fullAddressableId' in community) {
      // DataManager CommunityData type
      const [kind, pubkey, identifier] = community.fullAddressableId.split(':');
      return {
        kind: parseInt(kind),
        pubkey,
        identifier,
        relays: community.info.relays,
        name: community.info.name,
      };
    } else {
      // Legacy Community/UserCommunity type
      return {
        kind: 34550,
        pubkey: community.creator,
        identifier: community.id,
        relays: community.relays,
        name: community.name,
      };
    }
  };

  const communityData = getCommunityData(community);

  // Generate naddr for the community
  const naddr = nip19.naddrEncode({
    kind: communityData.kind,
    pubkey: communityData.pubkey,
    identifier: communityData.identifier,
    relays: communityData.relays.length > 0 ? communityData.relays : undefined,
  });

  // Generate shareable URLs
  const communityUrl = generateSpaceUrl(`${communityData.kind}:${communityData.pubkey}:${communityData.identifier}`);
  const joinUrl = `${window.location.origin}/join/${encodeURIComponent(naddr)}`;

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({
        title: 'Copied to clipboard',
        description: 'The link has been copied to your clipboard.',
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy to clipboard. Please copy manually.',
        variant: 'destructive',
      });
    }
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${communityData.name}`,
          text: `Join the ${communityData.name} community on Nostr!`,
          url: joinUrl,
        });
      } catch {
        // User cancelled or sharing failed - this is expected behavior
      }
    } else {
      // Fallback to copying the join URL
      copyToClipboard(joinUrl, 'native-share');
    }
  };

  const CopyButton = ({ text, field, className = '' }: { text: string; field: string; className?: string }) => (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={() => copyToClipboard(text, field)}
    >
      {copiedField === field ? (
        <Check className="h-4 w-4" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Share Community
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share {communityData.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Share */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Share</CardTitle>
              <CardDescription>
                Share this community with others using your device's native sharing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={shareNative} className="w-full">
                <Share2 className="h-4 w-4 mr-2" />
                Share Community
              </Button>
            </CardContent>
          </Card>

          <Separator />

          {/* Join Link */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="join-url" className="text-base font-medium">
                Join Link
              </Label>
              <p className="text-sm text-muted-foreground mb-2">
                Direct link for people to request to join your community in the main app
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                id="join-url"
                value={joinUrl}
                readOnly
                className="font-mono text-sm"
              />
              <CopyButton text={joinUrl} field="join-url" />
            </div>
          </div>

          {/* Community Link */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="community-url" className="text-base font-medium">
                Community Link
              </Label>
              <p className="text-sm text-muted-foreground mb-2">
                Direct link to open the community in the main app (for existing members)
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                id="community-url"
                value={communityUrl}
                readOnly
                className="font-mono text-sm"
              />
              <CopyButton text={communityUrl} field="community-url" />
            </div>
          </div>

          {/* Nostr Address */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="naddr" className="text-base font-medium">
                Nostr Address (naddr)
              </Label>
              <p className="text-sm text-muted-foreground mb-2">
                Technical identifier for Nostr clients and developers
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                id="naddr"
                value={naddr}
                readOnly
                className="font-mono text-sm"
              />
              <CopyButton text={naddr} field="naddr" />
            </div>
          </div>

          <Separator />

          {/* Additional Options */}
          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="flex items-center gap-2" disabled>
              <QrCode className="h-4 w-4" />
              QR Code
              <span className="text-xs text-muted-foreground ml-auto">Soon</span>
            </Button>
            <Button variant="outline" className="flex items-center gap-2" asChild>
              <a href={communityUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open Link
              </a>
            </Button>
          </div>

          {/* Tips */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <h4 className="font-medium mb-2">Sharing Tips</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Use the <strong>Join Link</strong> to invite new members - opens join dialog in the app</li>
                <li>• Share the <strong>Community Link</strong> with existing members - opens directly in the app</li>
                <li>• The <strong>naddr</strong> works in any Nostr client that supports communities</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}