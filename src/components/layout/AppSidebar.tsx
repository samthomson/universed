import { Plus, MessageCircle, Crown, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserCommunities } from "@/hooks/useUserCommunities";
import { useCommunityOrder } from "@/hooks/useCommunityOrder";
import { CommunitySelectionDialog } from "@/components/community/CommunitySelectionDialog";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { useSoundEffect } from "@/hooks/useSoundEffect";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ProfileModal } from "@/components/user/ProfileModal";
import { UserSettingsDialog } from "@/components/user/UserSettingsDialog";
import { logger } from "@/lib/logger";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import type { UserCommunity } from '@/hooks/useUserCommunities';

interface AppSidebarProps {
  selectedCommunity: string | null;
  showCommunitySelectionDialog: boolean;
  onShowCommunitySelectionDialogChange: (open: boolean) => void;
  onSelectCommunity: (communityId: string | null) => void;
}

// Inline SortableCommunityItem component
interface SortableCommunityItemProps {
  community: UserCommunity;
  isSelected: boolean;
  isLaunching: boolean;
  isLanding: boolean;
  isAnimating: boolean;
  onSelect: (communityId: string) => void;
}

function SortableCommunityItem({
  community,
  isSelected,
  isLaunching,
  isLanding,
  isAnimating,
  onSelect,
}: SortableCommunityItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: community.id,
    disabled: isAnimating, // Disable dragging during rocket animations
    data: { community },
  });

  // Restrict transform to vertical movement only, but don't interfere with rocket animations
  const style = {
    transform: !isLaunching && !isLanding && transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
    transition: !isLaunching && !isLanding ? transition : undefined,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  const handleClick = (e: React.MouseEvent) => {
    logger.log('Community clicked:', community.name, { isDragging, isAnimating, isLaunching, isLanding });
    
    // Stop propagation to prevent drag listeners from interfering
    e.stopPropagation();
    
    // Only handle click if we're not in the middle of a drag operation
    if (!isDragging && !isAnimating) {
      onSelect(community.id);
    }
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className={`
                w-12 h-12 rounded-2xl hover:rounded-xl hover:bg-gray-800/60
                transition-all duration-200 relative z-10
                ${isSelected ? 'bg-gray-900/80' : ''}
                ${isLaunching ? 'animate-rocket-launch' : ''}
                ${isLaunching ? 'shadow-lg shadow-purple-500/20' : ''}
                ${isLanding ? 'animate-rocket-landing' : ''}
                ${isLanding ? 'shadow-lg shadow-blue-500/20' : ''}
                ${isDragging ? 'cursor-grabbing scale-105' : 'cursor-grab'}
                ${isDragging ? 'shadow-lg shadow-blue-500/30' : ''}
              `}
              onClick={handleClick}
              disabled={isAnimating && !isLaunching && !isLanding}
            >
              {community.image ? (
                <Avatar className="w-12 h-12">
                  <AvatarImage src={community.image} alt={community.name} />
                  <AvatarFallback>
                    {community.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl hover:rounded-xl transition-all duration-200 flex items-center justify-center text-white font-semibold">
                  {community.name.slice(0, 2).toUpperCase()}
                </div>
              )}
            </Button>

            {/* Membership status indicator */}
            {community.membershipStatus === 'owner' && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center z-20">
                <Crown className="w-3 h-3 text-white" />
              </div>
            )}
            {community.membershipStatus === 'moderator' && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center z-20">
                <Shield className="w-3 h-3 text-white" />
              </div>
            )}

            {/* Launch phase effects - disabled during drag */}
            {isLaunching && !isDragging && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1.5 h-3 bg-gradient-to-t from-red-500 to-orange-400 rounded-full animate-pulse delay-75"></div>
                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-1 h-2 bg-gradient-to-t from-orange-600 to-red-500 rounded-full animate-pulse delay-150"></div>
                <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 w-0.5 h-1 bg-gradient-to-t from-yellow-500 to-transparent rounded-full animate-pulse delay-200"></div>

                {/* Enhanced launch glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-orange-500/30 animate-ping"></div>
                <div className="absolute inset-0 rounded-2xl bg-red-500/20 animate-pulse"></div>
              </div>
            )}

            {/* Landing phase effects - disabled during drag */}
            {isLanding && !isDragging && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Landing sparkles */}
                <div className="absolute -top-1 left-1 w-1 h-1 bg-blue-400 rounded-full animate-ping"></div>
                <div className="absolute -top-1 right-1 w-1 h-1 bg-blue-400 rounded-full animate-ping delay-100"></div>
                <div className="absolute -bottom-1 left-1 w-1 h-1 bg-blue-400 rounded-full animate-ping delay-200"></div>
                <div className="absolute -bottom-1 right-1 w-1 h-1 bg-blue-400 rounded-full animate-ping delay-300"></div>

                {/* Landing glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-blue-400/20 animate-pulse"></div>
              </div>
            )}

            {/* Drag glow effect */}
            {isDragging && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 rounded-2xl bg-blue-500/20 animate-pulse"></div>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <div className="space-y-1">
            <p>{community.name}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {community.membershipStatus === 'approved' ? 'Member' : community.membershipStatus}
            </p>
            {isDragging && (
              <p className="text-xs text-blue-400">Dragging...</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function AppSidebar({
  selectedCommunity,
  showCommunitySelectionDialog,
  onShowCommunitySelectionDialogChange,
  onSelectCommunity
}: AppSidebarProps) {
  const { data: communities, isLoading } = useUserCommunities();
  const { orderedCommunities, reorderCommunities } = useCommunityOrder(communities);
  const { playSound } = useSoundEffect();
  const isMobile = useIsMobile();
  const { user } = useCurrentUser();
  const author = useAuthor(user?.pubkey || '');
  const metadata = author.data?.metadata;
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  // State for sophisticated animation
  const [launchingCommunity, setLaunchingCommunity] = useState<string | null>(null);
  const [landingCommunity, setLandingCommunity] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Drag and drop sensors with click/drag distinction
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );




  // Handle drag end event
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      reorderCommunities(String(active.id), String(over.id));
    }
  }, [reorderCommunities]);

  // Handle drag start to detect if we're dragging
  const handleDragStart = useCallback(() => {
    logger.log('Drag started');
  }, []);

  // Handle click on communities (only when not dragging)
  const handleDragCancel = useCallback(() => {
    logger.log('Drag cancelled');
  }, []);

  // Handle community selection with sophisticated rocket animation
  const handleCommunitySelect = useCallback(async (communityId: string | null) => {
    logger.log('handleCommunitySelect called:', { communityId, selectedCommunity, isAnimating });
    
    if (!communityId || communityId === selectedCommunity || isAnimating) {
      onSelectCommunity(communityId);
      return;
    }

    setIsAnimating(true);

    // Phase 1: Launch animation
    setLaunchingCommunity(communityId);
    logger.log('🚀 Launch animation started for:', communityId);

    // Play launch sound immediately at very low volume
    playSound('/sounds/rocket-launching.mp3', 0.01);

    // Phase 2: After launch animation starts, fade out and move to top
    setTimeout(() => {
      setLaunchingCommunity(null);
      setLandingCommunity(communityId);
      logger.log('🛬 Landing animation started for:', communityId);

      // Actually select the community
      onSelectCommunity(communityId);

      // Phase 3: Clear landing animation after it completes (no landing sound)
      setTimeout(() => {
        setLandingCommunity(null);
        setIsAnimating(false);
      }, 600); // Landing animation duration
    }, 400); // Launch animation duration before fade out
  }, [selectedCommunity, isAnimating, playSound, onSelectCommunity]);

  // Reset animation states when component unmounts
  useEffect(() => {
    return () => {
      setLaunchingCommunity(null);
      setLandingCommunity(null);
      setIsAnimating(false);
    };
  }, []);

  // Memoize the community list rendering to avoid unnecessary re-renders
  const communityListContent = useMemo(() => {
    if (!isLoading && orderedCommunities) {
      return orderedCommunities.map((community) => (
        <SortableCommunityItem
          key={community.id}
          community={community}
          isSelected={selectedCommunity === community.id}
          isLaunching={launchingCommunity === community.id}
          isLanding={landingCommunity === community.id}
          isAnimating={isAnimating}
          onSelect={handleCommunitySelect}
        />
      ));
    } else if (isLoading) {
      // Skeleton loading for communities
      return Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="w-12 h-12 rounded-2xl" />
      ));
    } else {
      // No communities found
      return (
        <div className="text-xs text-muted-foreground text-center px-2">
          No communities
        </div>
      );
    }
  }, [isLoading, orderedCommunities, selectedCommunity, launchingCommunity, landingCommunity, isAnimating, handleCommunitySelect]);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* Fixed top section - Notifications and Direct Messages */}
        <div className="flex flex-col items-center pt-3 pb-2 space-y-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative">
                <NotificationCenter />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Notifications</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`w-12 h-12 rounded-2xl hover:rounded-xl hover:bg-gray-800/60 transition-all duration-200 ${
                  selectedCommunity === null ? 'bg-gray-900/80' : ''
                }`}
                onClick={() => onSelectCommunity(null)}
              >
                <MessageCircle className="w-6 h-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Direct Messages</p>
            </TooltipContent>
          </Tooltip>

          {/* Separator */}
          <div className="w-8 h-0.5 bg-gray-600 rounded-full" />
        </div>

        {/* Scrollable communities section */}
        <ScrollArea className="flex-1 px-2">
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
            autoScroll={{ threshold: { x: 0, y: 0.2 } }}
          >
            <SortableContext 
              items={orderedCommunities?.map(c => c.id) || []}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col items-center space-y-2 pb-2">
                {communityListContent}
              </div>
            </SortableContext>
          </DndContext>
        </ScrollArea>

        {/* Fixed bottom section - Add Community Button */}
        <div className="flex flex-col items-center pt-2 pb-3 space-y-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-12 h-12 rounded-2xl hover:rounded-xl transition-all duration-200 border-2 border-dashed border-gray-600 hover:border-green-500 text-green-500"
                onClick={() => onShowCommunitySelectionDialogChange(true)}
              >
                <Plus className="w-6 h-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Add a Community</p>
            </TooltipContent>
          </Tooltip>

          {/* User Profile Picture - Only show in mobile view */}
          {isMobile && user && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-12 h-12 rounded-2xl hover:rounded-xl transition-all duration-200"
                  onClick={() => setShowProfileModal(true)}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={metadata?.picture} alt={metadata?.name || genUserName(user.pubkey)} />
                    <AvatarFallback className="bg-indigo-600 text-white text-xs">
                      {(metadata?.name || genUserName(user.pubkey)).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>View Profile</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <CommunitySelectionDialog
          open={showCommunitySelectionDialog}
          onOpenChange={onShowCommunitySelectionDialogChange}
          onCommunitySelect={onSelectCommunity}
        />

        {/* Profile Modal */}
        <ProfileModal
          open={showProfileModal}
          onOpenChange={setShowProfileModal}
          onOpenSettings={() => {
            setShowProfileModal(false);
            setShowSettingsDialog(true);
          }}
        />

        {/* Settings Dialog */}
        <UserSettingsDialog
          open={showSettingsDialog}
          onOpenChange={setShowSettingsDialog}
        />
      </div>
    </TooltipProvider>
  );
}