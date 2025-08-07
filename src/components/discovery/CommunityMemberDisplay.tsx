import { ProfileAvatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { CommunityMember } from "@/hooks/useCommunityMembers";

interface CommunityMemberDisplayProps {
  members: CommunityMember[];
  isLoading: boolean;
  className?: string;
}

export function CommunityMemberDisplay({
  members,
  isLoading,
  className
}: CommunityMemberDisplayProps) {
  if (isLoading) {
    return (
      <div className={cn("flex items-center", className)}>
        {/* Loading skeleton for members */}
        <div className="flex">
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="w-10 h-10 rounded-full -ml-3" />
          <Skeleton className="w-10 h-10 rounded-full -ml-3" />
          <Skeleton className="w-10 h-10 rounded-full -ml-3" />
        </div>
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <div className={cn("text-center text-gray-500 text-sm", className)}>
        No members yet
      </div>
    );
  }

  // Include all members: regular members, moderators, and creator
  const allMembers = members; // This includes all roles: member, moderator, owner

  if (allMembers.length === 0) {
    return (
      <div className={cn("text-center text-gray-500 text-sm", className)}>
        No members yet
      </div>
    );
  }

  // Display logic: show first 3, then +X if more than 3
  const displayMembers = allMembers.slice(0, 3);
  const shouldShowRemaining = allMembers.length > 3;
  const remainingCount = allMembers.length - 3;

  return (
    <div className={cn("flex items-center justify-start", className)}>
      <div className="flex">
        {displayMembers.map((member, index) => (
          <div
            key={member.pubkey}
            className={cn(
              "relative",
              index > 0 && "-ml-4" // Reduced spacing for more compact look
            )}
            style={{
              zIndex: index + 1, // Increasing z-index: first avatar (index 0) = z-index 1, second (index 1) = z-index 2, etc.
            }}
          >
            <ProfileAvatar
              pubkey={member.pubkey}
              size="md"
              shape="circle"
            />
          </div>
        ))}

        {/* Show +X badge only if there are more than 3 members */}
        {shouldShowRemaining && (
          <div
            className={cn(
              "rounded-full bg-gray-600 dark:bg-gray-700 text-white font-medium flex items-center justify-center border-white dark:border-gray-800 w-8 h-8 -ml-4 relative"
            )}
            style={{
              zIndex: 4, // Lowest z-index for the badge
            }}
          >
            <span className="text-sm">
              +{remainingCount}
            </span>
          </div>
        )}
      </div>

      {/* Member count text */}
      <span className="text-xs text-gray-400 ml-2">
        {allMembers.length} {allMembers.length === 1 ? 'member' : 'members'}
      </span>
    </div>
  );
}