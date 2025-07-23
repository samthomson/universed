import { MarketplaceSpace } from './MarketplaceSpace';
import { ResourcesSpace } from './ResourcesSpace';
import { useSpaces } from '@/hooks/useSpaces';
import { Card, CardContent } from '@/components/ui/card';
import { Box } from 'lucide-react';

interface SpacesAreaProps {
  communityId: string;
  selectedSpace: string | null;
}

export function SpacesArea({ communityId, selectedSpace }: SpacesAreaProps) {
  const { data: spaces } = useSpaces(communityId);

  if (!selectedSpace) {
    return null;
  }

  const space = spaces?.find(s => s.id === selectedSpace);

  if (!space) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="border-dashed max-w-md">
          <CardContent className="py-12 px-8 text-center">
            <Box className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Space not found</h3>
            <p className="text-muted-foreground">
              The selected space could not be found or may have been removed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render the appropriate space component based on type
  switch (space.type) {
    case 'marketplace':
      return <MarketplaceSpace communityId={communityId} />;

    case 'resources':
      return <ResourcesSpace communityId={communityId} />;

    case 'custom':
    default:
      return (
        <div className="flex-1 flex items-center justify-center">
          <Card className="border-dashed max-w-md">
            <CardContent className="py-12 px-8 text-center">
              <Box className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{space.name}</h3>
              <p className="text-muted-foreground mb-4">
                {space.description || 'This custom space is not yet implemented.'}
              </p>
              <p className="text-sm text-muted-foreground">
                Custom space functionality coming soon!
              </p>
            </CardContent>
          </Card>
        </div>
      );
  }
}