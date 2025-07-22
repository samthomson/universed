import { Crown, Shield, Users } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCommunityMembers } from "@/hooks/useCommunityMembers";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";
import { Skeleton } from "@/components/ui/skeleton";

interface MemberListProps {
  communityId: string | null;
  channelId?: string | null;
}

interface MemberItemProps {
  pubkey: string;
  role?: 'owner' | 'moderator' | 'member';
  isOnline?: boolean;
}

function MemberItem({ pubkey, role = 'member', isOnline = false }: MemberItemProps) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;

  const displayName = metadata?.name || genUserName(pubkey);
  const profileImage = metadata?.picture;

  const getRoleIcon = () => {
    switch (role) {
      case 'owner':
        return <Crown className="w-3 h-3 text-yellow-500" />;
      case 'moderator':
        return <Shield className="w-3 h-3 text-blue-500" />;
      default:
        return null;
    }
  };

  const getRoleColor = () => {
    switch (role) {
      case 'owner':
        return 'text-yellow-400';
      case 'moderator':
        return 'text-blue-400';
      default:
        return 'text-gray-300';
    }
  };

  return (
    <div className="flex items-center space-x-2 px-2 py-1 hover:bg-gray-600/50 rounded cursor-pointer group">
      <div className="relative">
        <Avatar className="w-8 h-8">
          <AvatarImage src={profileImage} alt={displayName} />
          <AvatarFallback className="bg-indigo-600 text-white text-xs">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {isOnline && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-gray-700 rounded-full" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-1">
          {getRoleIcon()}
          <span className={`text-sm font-medium truncate ${getRoleColor()}`}>
            {displayName}
          </span>
        </div>
      </div>
    </div>
  );
}

export function MemberList({ communityId }: MemberListProps) {
  const { data: members, isLoading } = useCommunityMembers(communityId);

  if (!communityId) {
    return (
      <div className="p-4">
        <div className="text-center text-gray-400">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No members to show</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-600">
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-300">
            Members {members && `— ${members.length}`}
          </span>
        </div>
      </div>

      {/* Member List */}
      <ScrollArea className="flex-1 p-2">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-2 px-2 py-1">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="flex-1 h-4" />
              </div>
            ))}
          </div>
        ) : members && members.length > 0 ? (
          <div className="space-y-0.5">
            {/* Online Members */}
            <div className="mb-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 py-1">
                Online — {members.filter(m => m.isOnline).length}
              </div>
              {members
                .filter(member => member.isOnline)
                .map((member) => (
                  <MemberItem
                    key={member.pubkey}
                    pubkey={member.pubkey}
                    role={member.role}
                    isOnline={member.isOnline}
                  />
                ))}
            </div>

            {/* Offline Members */}
            {members.some(m => !m.isOnline) && (
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 py-1">
                  Offline — {members.filter(m => !m.isOnline).length}
                </div>
                {members
                  .filter(member => !member.isOnline)
                  .map((member) => (
                    <MemberItem
                      key={member.pubkey}
                      pubkey={member.pubkey}
                      role={member.role}
                      isOnline={member.isOnline}
                    />
                  ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-400 py-8">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No members found</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}