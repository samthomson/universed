import { useState } from 'react';
import { Search, UserPlus, X, Shield, Users, Hash, Settings, Check, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

import { useUserSearch } from '@/hooks/useUserSearch';
import { useAuthor } from '@/hooks/useAuthor';
import { useFriends } from '@/hooks/useFriends';
import { genUserName } from '@/lib/genUserName';

interface QuickSetupStepProps {
  selectedModerators: string[];
  onModeratorsChange: (moderators: string[]) => void;
  requireApproval: boolean;
  onRequireApprovalChange: (require: boolean) => void;
  preApprovedUsers: string[];
  onPreApprovedUsersChange: (users: string[]) => void;
  onCreateCommunity: () => void;
  onPrevious: () => void;
}

export function QuickSetupStep({
  selectedModerators,
  onModeratorsChange,
  requireApproval,
  onRequireApprovalChange,
  preApprovedUsers,
  onPreApprovedUsersChange,
  onCreateCommunity,
  onPrevious
}: QuickSetupStepProps) {
  const [moderatorSearchQuery, setModeratorSearchQuery] = useState('');
  const [preApprovedSearchQuery, setPreApprovedSearchQuery] = useState('');
  const { data: friends } = useFriends();

  const isUserFriend = (pubkey: string) => {
    return friends?.some(friend => friend.pubkey === pubkey) || false;
  };

  const { data: moderatorSearchResults, isLoading: isSearchingModerators } = useUserSearch(moderatorSearchQuery);
  const { data: preApprovedSearchResults, isLoading: isSearchingPreApproved } = useUserSearch(preApprovedSearchQuery);

  const addModerator = (pubkey: string) => {
    if (!selectedModerators.includes(pubkey)) {
      onModeratorsChange([...selectedModerators, pubkey]);
    }
  };

  const removeModerator = (pubkey: string) => {
    onModeratorsChange(selectedModerators.filter(p => p !== pubkey));
  };

  const addPreApprovedUser = (pubkey: string) => {
    if (!preApprovedUsers.includes(pubkey)) {
      onPreApprovedUsersChange([...preApprovedUsers, pubkey]);
    }
  };

  const removePreApprovedUser = (pubkey: string) => {
    onPreApprovedUsersChange(preApprovedUsers.filter(p => p !== pubkey));
  };

  const ModeratorCard = ({ pubkey }: { pubkey: string }) => {
    const author = useAuthor(pubkey);
    const metadata = author.data?.metadata;
    const displayName = metadata?.name || genUserName(pubkey);
    const profileImage = metadata?.picture;
    const nip05 = metadata?.nip05;
    const isFriend = isUserFriend(pubkey);

    return (
      <Card className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Avatar className="w-10 h-10">
                <AvatarImage src={profileImage} />
                <AvatarFallback className="bg-purple-600 text-white">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isFriend && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <Users className="w-2 h-2 text-white" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{displayName}</p>
                {isFriend && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    Following
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground font-mono">{pubkey.slice(0, 16)}...</p>
                {nip05 && (
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                    ✓ {nip05}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="bg-purple-100 text-purple-800">
              <Shield className="w-3 h-3 mr-1" />
              Moderator
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeModerator(pubkey)}
              className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/20"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  const PreApprovedUserCard = ({ pubkey }: { pubkey: string }) => {
    const author = useAuthor(pubkey);
    const metadata = author.data?.metadata;
    const displayName = metadata?.name || genUserName(pubkey);
    const profileImage = metadata?.picture;
    const nip05 = metadata?.nip05;
    const isFriend = isUserFriend(pubkey);

    return (
      <Card className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Avatar className="w-10 h-10">
                <AvatarImage src={profileImage} />
                <AvatarFallback className="bg-green-600 text-white">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isFriend && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <Users className="w-2 h-2 text-white" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{displayName}</p>
                {isFriend && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    Following
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground font-mono">{pubkey.slice(0, 16)}...</p>
                {nip05 && (
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                    ✓ {nip05}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <CheckCircle className="w-3 h-3 mr-1" />
              Pre-approved
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removePreApprovedUser(pubkey)}
              className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/20"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  const SearchResultCard = ({ pubkey, type }: { pubkey: string; type: 'moderator' | 'preapproved' }) => {
    const author = useAuthor(pubkey);
    const metadata = author.data?.metadata;
    const displayName = metadata?.name || genUserName(pubkey);
    const profileImage = metadata?.picture;
    const nip05 = metadata?.nip05;
    const isFriend = isUserFriend(pubkey);

    const isModeratorSelected = selectedModerators.includes(pubkey);
    const isPreApprovedSelected = preApprovedUsers.includes(pubkey);

    const isSelected = type === 'moderator' ? isModeratorSelected : isPreApprovedSelected;
    const addAction = type === 'moderator' ? addModerator : addPreApprovedUser;
    const removeAction = type === 'moderator' ? removeModerator : removePreApprovedUser;
    const selectedColor = type === 'moderator' ? 'bg-purple-900/50 border-purple-500/30' : 'bg-green-900/50 border-green-500/30';
    const buttonColor = type === 'moderator' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700';

    return (
      <Card className={`p-3 cursor-pointer transition-colors ${isSelected ? selectedColor : 'hover:bg-slate-800/50'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Avatar className="w-10 h-10">
                <AvatarImage src={profileImage} />
                <AvatarFallback className="bg-gray-600 text-white">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isFriend && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <Users className="w-2 h-2 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate">{displayName}</p>
                {isFriend && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    Following
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground font-mono truncate">{pubkey.slice(0, 16)}...</p>
                {nip05 && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 truncate max-w-[120px]">
                    {nip05}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => isSelected ? removeAction(pubkey) : addAction(pubkey)}
            className={isSelected ? buttonColor : "bg-slate-800/50 border-slate-700/50 text-purple-200 hover:bg-slate-700/50 hover:text-white"}
          >
            {isSelected ? (
              <>
                <Check className="w-4 h-4 mr-1" />
                Selected
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-1" />
                Add
              </>
            )}
          </Button>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Section - Moderators */}
      <div className='relative p-6 rounded-2xl bg-slate-800/40 backdrop-blur-sm border border-slate-700/50'>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center shadow-lg border border-purple-500/30">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-2xl font-bold text-white">
              MODERATORS
            </h3>
          </div>

          <p className="text-purple-200">
            Add trusted users to help manage your community. You're automatically a moderator.
          </p>

          {/* Selected Moderators */}
          {selectedModerators.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-purple-300">
                Selected ({selectedModerators.length})
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedModerators.map((pubkey) => (
                  <ModeratorCard key={pubkey} pubkey={pubkey} />
                ))}
              </div>
            </div>
          )}

          {/* Search for Moderators */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search by name, npub, or nip-05..."
                value={moderatorSearchQuery}
                onChange={(e) => setModeratorSearchQuery(e.target.value)}
                className="pl-10 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20"
              />
            </div>

            {/* Search Results */}
            {moderatorSearchQuery && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {isSearchingModerators ? (
                  <div className="text-center py-4 text-purple-300">
                    Searching users...
                  </div>
                ) : moderatorSearchResults && moderatorSearchResults.length > 0 ? (
                  moderatorSearchResults.slice(0, 5).map((pubkey) => (
                    <SearchResultCard key={`mod-${pubkey}`} pubkey={pubkey} type="moderator" />
                  ))
                ) : (
                  <div className="text-center py-4 text-purple-300">
                    No users found. Try a different search term.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Middle Section - User Approval */}
      <div className='relative p-6 rounded-2xl bg-slate-800/40 backdrop-blur-sm border border-slate-700/50'>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center shadow-lg border border-green-500/30">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <h3 className="text-2xl font-bold text-white">
              MEMBER APPROVAL
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="approval"
              checked={requireApproval}
              onCheckedChange={onRequireApprovalChange}
            />
            <Label htmlFor="approval" className="text-sm font-medium text-purple-200">
              Require approval for new members
            </Label>
          </div>

          {requireApproval && (
            <>
              <p className="text-purple-200">
                These users will be automatically approved when they request to join:
              </p>

              {/* Selected Pre-approved Users */}
              {preApprovedUsers.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-green-300">
                    Pre-approved ({preApprovedUsers.length})
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {preApprovedUsers.map((pubkey) => (
                      <PreApprovedUserCard key={pubkey} pubkey={pubkey} />
                    ))}
                  </div>
                </div>
              )}

              {/* Search for Pre-approved Users */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search by name, npub, or nip-05..."
                    value={preApprovedSearchQuery}
                    onChange={(e) => setPreApprovedSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20"
                  />
                </div>

                {/* Search Results */}
                {preApprovedSearchQuery && (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {isSearchingPreApproved ? (
                      <div className="text-center py-4 text-purple-300">
                        Searching users...
                      </div>
                    ) : preApprovedSearchResults && preApprovedSearchResults.length > 0 ? (
                      preApprovedSearchResults.slice(0, 5).map((pubkey) => (
                        <SearchResultCard key={`pre-${pubkey}`} pubkey={pubkey} type="preapproved" />
                      ))
                    ) : (
                      <div className="text-center py-4 text-purple-300">
                        No users found. Try a different search term.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Section - What's Included */}
      <div className='relative p-6 rounded-2xl bg-slate-800/40 backdrop-blur-sm border border-slate-700/50'>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center shadow-lg border border-purple-500/30">
              <Settings className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-2xl font-bold text-white">
              WHAT'S INCLUDED
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center mx-auto shadow-lg border border-green-500/30">
                <Hash className="w-6 h-6 text-green-400" />
              </div>
              <p className="font-medium text-sm text-white">General Channel</p>
              <p className="text-xs text-purple-200">Text channel for discussions</p>
            </div>
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto shadow-lg border border-blue-500/30">
                <Shield className="w-6 h-6 text-blue-400" />
              </div>
              <p className="font-medium text-sm text-white">Moderation Tools</p>
              <p className="text-xs text-purple-200">Basic community management</p>
            </div>
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center mx-auto shadow-lg border border-purple-500/30">
                <Users className="w-6 h-6 text-purple-400" />
              </div>
              <p className="font-medium text-sm text-white">Member Management</p>
              <p className="text-xs text-purple-200">User approval and roles</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onPrevious} className="bg-slate-800/50 border-slate-700/50 text-purple-200 hover:bg-slate-700/50 hover:text-white rounded-full">
          Previous
        </Button>
        <Button onClick={onCreateCommunity} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transform transition-all duration-200 hover:scale-105 shadow-lg shadow-purple-500/25 rounded-full">
          Create Community
        </Button>
      </div>
    </div>
  );
}