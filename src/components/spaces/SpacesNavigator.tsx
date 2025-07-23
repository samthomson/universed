import { useState } from 'react';
import {
  ChevronRight,
  Settings,
  ShoppingBag,
  BookOpen,
  Box,
  Palette,
  Globe,
  Users,
  MessageSquare,
  Calendar,
  Music,
  Camera,
  Code,
  Gamepad2,
  Heart,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SpaceManagementDialog } from './SpaceManagementDialog';
import { useSpaces, type Space } from '@/hooks/useSpaces';
import { useCanModerate } from '@/hooks/useCommunityRoles';

interface SpacesNavigatorProps {
  communityId: string;
  selectedSpace: string | null;
  onSelectSpace: (spaceId: string | null) => void;
}

const ICON_COMPONENTS = {
  ShoppingBag,
  BookOpen,
  Box,
  Palette,
  Globe,
  Users,
  MessageSquare,
  Calendar,
  Music,
  Camera,
  Code,
  Gamepad2,
  Heart,
  Zap,
};

export function SpacesNavigator({
  communityId,
  selectedSpace,
  onSelectSpace
}: SpacesNavigatorProps) {
  const { data: spaces } = useSpaces(communityId);
  const { canModerate } = useCanModerate(communityId);
  const [isOpen, setIsOpen] = useState(true);
  const [showManagement, setShowManagement] = useState(false);

  const getIconComponent = (iconName: string) => {
    return ICON_COMPONENTS[iconName as keyof typeof ICON_COMPONENTS] || Box;
  };

  if (!spaces || spaces.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between group">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="flex-1 justify-start p-1 h-auto text-xs font-semibold text-gray-400 hover:text-gray-300 hover:bg-gray-600/30 rounded-sm transition-all duration-150"
            >
              <ChevronRight className={`w-3 h-3 mr-1 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
              <span className="tracking-wide">SPACES</span>
              {spaces.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs px-1 py-0">
                  {spaces.length}
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>

          {canModerate && (
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:bg-gray-600/40"
              onClick={() => setShowManagement(true)}
            >
              <Settings className="w-3 h-3" />
            </Button>
          )}
        </div>

        <CollapsibleContent className="space-y-0.5">
          {spaces.map((space) => (
            <SpaceItem
              key={space.id}
              space={space}
              isSelected={selectedSpace === space.id}
              onSelect={() => onSelectSpace(space.id)}
              getIconComponent={getIconComponent}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>

      {/* Space Management Dialog */}
      <SpaceManagementDialog
        communityId={communityId}
        open={showManagement}
        onOpenChange={setShowManagement}
      />
    </div>
  );
}

function SpaceItem({
  space,
  isSelected,
  onSelect,
  getIconComponent,
}: {
  space: Space;
  isSelected: boolean;
  onSelect: () => void;
  getIconComponent: (iconName: string) => React.ComponentType<{ className?: string }>;
}) {
  const IconComponent = getIconComponent(space.icon);

  return (
    <div className="ml-4">
      <Button
        variant="ghost"
        size="sm"
        className={`
          w-full justify-start px-2 py-1 h-auto min-h-[32px] rounded-sm transition-all duration-150 relative
          ${isSelected
            ? 'bg-gray-600/60 text-white shadow-sm'
            : 'text-gray-300 hover:text-gray-100 hover:bg-gray-600/40'
          }
        `}
        onClick={onSelect}
      >
        <IconComponent className="w-4 h-4 mr-2 text-gray-400" />
        <span className="text-sm font-medium truncate">{space.name}</span>

        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-5 bg-white dark:bg-gray-200 rounded-r-full"></div>
        )}
      </Button>
    </div>
  );
}