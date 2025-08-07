import { Plus, MessageCircle, Crown, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserCommunities } from "@/hooks/useUserCommunities";
import { useUnifiedPreloader } from "@/hooks/useUnifiedPreloader";
import { CommunitySelectionDialog } from "@/components/community/CommunitySelectionDialog";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { useSoundEffect } from "@/hooks/useSoundEffect";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ProfileModal } from "@/components/user/ProfileModal";
import { UserSettingsDialog } from "@/components/user/UserSettingsDialog";
import { useState, useEffect, useCallback } from "react";

interface AppSidebarProps {
  selectedCommunity: string | null;
  showCommunitySelectionDialog: boolean;
  onShowCommunitySelectionDialogChange: (open: boolean) => void;
  onSelectCommunity: (communityId: string | null) => void;
}

export function AppSidebar({
  selectedCommunity,
  showCommunitySelectionDialog,
  onShowCommunitySelectionDialogChange,
  onSelectCommunity
}: AppSidebarProps) {
  const { data: communities, isLoading } = useUserCommunities();
  const { preloadCommunity } = useUnifiedPreloader();
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

  // Reorder communities to put the selected one first
  const orderedCommunities = communities ? [...communities].sort((a, b) => {
    if (selectedCommunity === a.id) return -1; // a comes first
    if (selectedCommunity === b.id) return 1;  // b comes first
    return 0; // maintain original order for others
  }) : null;

  // Handle community selection with sophisticated rocket animation
  const handleCommunitySelect = useCallback(async (communityId: string | null) => {
    if (!communityId || communityId === selectedCommunity || isAnimating) {
      onSelectCommunity(communityId);
      return;
    }

    setIsAnimating(true);

    // Phase 1: Launch animation
    setLaunchingCommunity(communityId);

    // Play launch sound immediately at very low volume
    playSound('/sounds/rocket-launching.mp3', 0.01);

    // Phase 2: After launch animation starts, fade out and move to top
    setTimeout(() => {
      setLaunchingCommunity(null);
      setLandingCommunity(communityId);

      // Actually select the community (triggers reordering)
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
          <div className="flex flex-col items-center space-y-2 pb-2">
            {!isLoading && orderedCommunities ? orderedCommunities.map((community, index) => {
              const isSelected = selectedCommunity === community.id;
              const isLaunching = launchingCommunity === community.id;
              const isLanding = landingCommunity === community.id;
              const isFirstPosition = index === 0 && isSelected;

              return (
                <Tooltip key={community.id}>
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
                          ${isLanding && isFirstPosition ? 'animate-rocket-landing' : ''}
                          ${isLanding && isFirstPosition ? 'shadow-lg shadow-blue-500/20' : ''}
                        `}
                        onClick={() => handleCommunitySelect(community.id)}
                        onMouseDown={() => preloadCommunity(community.id)}
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

                    {/* Launch phase effects */}
                    {isLaunching && (
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1.5 h-3 bg-gradient-to-t from-red-500 to-orange-400 rounded-full animate-pulse delay-75"></div>
                        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-1 h-2 bg-gradient-to-t from-orange-600 to-red-500 rounded-full animate-pulse delay-150"></div>
                        <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 w-0.5 h-1 bg-gradient-to-t from-yellow-500 to-transparent rounded-full animate-pulse delay-200"></div>

                        {/* Enhanced launch glow effect */}
                        <div className="absolute inset-0 rounded-2xl bg-orange-500/30 animate-ping"></div>
                        <div className="absolute inset-0 rounded-2xl bg-red-500/20 animate-pulse"></div>
                      </div>
                    )}

                    {/* Landing phase effects */}
                    {isLanding && isFirstPosition && (
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
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="space-y-1">
                    <p>{community.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {community.membershipStatus === 'approved' ? 'Member' : community.membershipStatus}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
            }) : isLoading ? (
              // Skeleton loading for communities
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="w-12 h-12 rounded-2xl" />
              ))
            ) : (
              // No communities found
              <div className="text-xs text-muted-foreground text-center px-2">
                No communities
              </div>
            )}
          </div>
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