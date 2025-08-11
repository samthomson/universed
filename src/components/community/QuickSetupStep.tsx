import { useState } from 'react';
import { Search, UserPlus, X, Shield, Users, Hash, Settings, Check, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

import { useUserSearch } from '@/hooks/useUserSearch';
import { useAuthor } from '@/hooks/useAuthor';
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

    return (
      <Card className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={profileImage} />
              <AvatarFallback className="bg-purple-600 text-white">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm">{displayName}</p>
              <p className="text-xs text-muted-foreground">{pubkey.slice(0, 16)}...</p>
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
              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
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

    return (
      <Card className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={profileImage} />
              <AvatarFallback className="bg-green-600 text-white">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm">{displayName}</p>
              <p className="text-xs text-muted-foreground">{pubkey.slice(0, 16)}...</p>
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
              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
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

    const isModeratorSelected = selectedModerators.includes(pubkey);
    const isPreApprovedSelected = preApprovedUsers.includes(pubkey);

    const isSelected = type === 'moderator' ? isModeratorSelected : isPreApprovedSelected;
    const addAction = type === 'moderator' ? addModerator : addPreApprovedUser;
    const removeAction = type === 'moderator' ? removeModerator : removePreApprovedUser;
    const selectedColor = type === 'moderator' ? 'bg-purple-50 border-purple-200' : 'bg-green-50 border-green-200';
    const buttonColor = type === 'moderator' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700';

    return (
      <Card className={`p-3 cursor-pointer transition-colors ${isSelected ? selectedColor : 'hover:bg-gray-50'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={profileImage} />
              <AvatarFallback className="bg-gray-600 text-white">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm">{displayName}</p>
              <p className="text-xs text-muted-foreground">{pubkey.slice(0, 16)}...</p>
            </div>
          </div>
          <Button
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => isSelected ? removeAction(pubkey) : addAction(pubkey)}
            className={isSelected ? buttonColor : ""}
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
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Moderators
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Add trusted users to help manage your community. You're automatically a moderator.
          </p>

          {/* Selected Moderators */}
          {selectedModerators.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-purple-700">
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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search users to add as moderators..."
                value={moderatorSearchQuery}
                onChange={(e) => setModeratorSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Search Results */}
            {moderatorSearchQuery && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {isSearchingModerators ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Searching users...
                  </div>
                ) : moderatorSearchResults && moderatorSearchResults.length > 0 ? (
                  moderatorSearchResults.slice(0, 5).map((pubkey) => (
                    <SearchResultCard key={`mod-${pubkey}`} pubkey={pubkey} type="moderator" />
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No users found
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Middle Section - User Approval */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            User Approval
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Approval Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Require Approval</Label>
              <p className="text-sm text-muted-foreground">
                New members need approval to post
              </p>
            </div>
            <Switch
              checked={requireApproval}
              onCheckedChange={onRequireApprovalChange}
            />
          </div>

          {/* Pre-approved Users */}
          {requireApproval && (
            <div className="space-y-4 pt-2 border-t">
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-green-700">
                  Pre-approved Users ({preApprovedUsers.length})
                </h4>
                {preApprovedUsers.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {preApprovedUsers.map((pubkey) => (
                      <PreApprovedUserCard key={pubkey} pubkey={pubkey} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No pre-approved users yet. Add users who should have immediate access.
                  </p>
                )}
              </div>

              {/* Search for Pre-approved Users */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search users to pre-approve..."
                    value={preApprovedSearchQuery}
                    onChange={(e) => setPreApprovedSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Search Results */}
                {preApprovedSearchQuery && (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {isSearchingPreApproved ? (
                      <div className="text-center py-4 text-muted-foreground">
                        Searching users...
                      </div>
                    ) : preApprovedSearchResults && preApprovedSearchResults.length > 0 ? (
                      preApprovedSearchResults.slice(0, 5).map((pubkey) => (
                        <SearchResultCard key={`pre-${pubkey}`} pubkey={pubkey} type="preapproved" />
                      ))
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        No users found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom Section - What's Included */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="w-5 h-5" />
            What's Included
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Hash className="w-6 h-6 text-green-600" />
              </div>
              <p className="font-medium text-sm">General Channel</p>
              <p className="text-xs text-muted-foreground">Text channel for discussions</p>
            </div>
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <p className="font-medium text-sm">Moderation Tools</p>
              <p className="text-xs text-muted-foreground">Basic community management</p>
            </div>
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <p className="font-medium text-sm">Member Management</p>
              <p className="text-xs text-muted-foreground">User approval and roles</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onPrevious}>
          Previous
        </Button>
        <Button onClick={onCreateCommunity} className="bg-purple-600 hover:bg-purple-700">
          Create Community
        </Button>
      </div>
    </div>
  );
}