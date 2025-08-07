import { MarketplaceSpace } from './MarketplaceSpace';
import { ResourcesSpace } from './ResourcesSpace';
import { useSpaces } from '@/hooks/useSpaces';
import { Card, CardContent } from '@/components/ui/card';
import { Box } from 'lucide-react';

interface SpacesAreaProps {
  communityId: string;
  selectedSpace: string | null;
  onNavigateToDMs?: (targetPubkey?: string) => void;
}

export function SpacesArea({ communityId, selectedSpace, onNavigateToDMs }: SpacesAreaProps) {
  const { data: spaces } = useSpaces(communityId);

  if (!selectedSpace) {
    return null;
  }

  const space = spaces?.find(s => s.id === selectedSpace);

  if (!space) {
    return (
      <div className="flex-1 bg-gray-800 flex items-center justify-center h-full">
        <Card className="border-dashed border-gray-600 bg-gray-750 max-w-md">
          <CardContent className="py-12 px-8 text-center">
            <Box className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-gray-200">Space not found</h3>
            <p className="text-gray-400">
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
      return <MarketplaceSpace communityId={communityId} onNavigateToDMs={onNavigateToDMs} />;

    case 'resources':
      return <ResourcesSpace communityId={communityId} />;

    case 'custom':
    default:
      return (
        <div className="flex-1 bg-gray-800 flex items-center justify-center h-full">
          <Card className="border-dashed border-gray-600 bg-gray-750 max-w-md">
            <CardContent className="py-12 px-8 text-center">
              <Box className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-gray-200">{space.name}</h3>
              <p className="text-gray-400 mb-4">
                {space.description || 'This custom space is not yet implemented.'}
              </p>
              <p className="text-sm text-gray-500">
                Custom space functionality coming soon!
              </p>
            </CardContent>
          </Card>
        </div>
      );
  }
}