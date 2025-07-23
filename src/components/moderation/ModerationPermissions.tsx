import { useState } from 'react';
import { Shield, Crown, Users, Settings, Lock, Unlock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCanModerate, useCommunityModerators } from '@/hooks/useCommunityRoles';
import { useAuthor } from '@/hooks/useAuthor';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { genUserName } from '@/lib/genUserName';

interface ModerationPermissionsProps {
  communityId: string;
}

interface ModeratorPermissions {
  canDeletePosts: boolean;
  canBanUsers: boolean;
  canMuteUsers: boolean;
  canPinPosts: boolean;
  canApproveContent: boolean;
  canManageChannels: boolean;
  canViewAnalytics: boolean;
  canManageRoles: boolean;
  canAccessSettings: boolean;
}

interface ModeratorCardProps {
  pubkey: string;
  _communityId: string;
  permissions: ModeratorPermissions;
  onPermissionChange: (pubkey: string, permissions: ModeratorPermissions) => void;
  canEdit: boolean;
}

function ModeratorCard({ pubkey, _communityId, permissions, onPermissionChange, canEdit }: ModeratorCardProps) {
  const author = useAuthor(pubkey);
  const displayName = author.data?.metadata?.name || genUserName(pubkey);
  const avatar = author.data?.metadata?.picture;

  const handlePermissionToggle = (permission: keyof ModeratorPermissions, value: boolean) => {
    if (!canEdit) return;

    onPermissionChange(pubkey, {
      ...permissions,
      [permission]: value,
    });
  };

  const permissionLabels = {
    canDeletePosts: 'Delete Posts',
    canBanUsers: 'Ban Users',
    canMuteUsers: 'Mute Users',
    canPinPosts: 'Pin Posts',
    canApproveContent: 'Approve Content',
    canManageChannels: 'Manage Channels',
    canViewAnalytics: 'View Analytics',
    canManageRoles: 'Manage Roles',
    canAccessSettings: 'Access Settings',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={avatar} />
            <AvatarFallback>
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="font-medium">{displayName}</div>
            <div className="text-sm text-muted-foreground">
              {pubkey.slice(0, 16)}...
            </div>
          </div>
          <Badge variant="secondary">
            <Shield className="h-3 w-3 mr-1" />
            Moderator
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(permissionLabels).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <Label className="text-sm">{label}</Label>
              <Switch
                checked={permissions[key as keyof ModeratorPermissions]}
                onCheckedChange={(checked) => handlePermissionToggle(key as keyof ModeratorPermissions, checked)}
                disabled={!canEdit}
              />
            </div>
          ))}
        </div>

        {canEdit && (
          <div className="pt-3 border-t">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // Set all permissions to true
                  const allPermissions = Object.keys(permissionLabels).reduce((acc, key) => ({
                    ...acc,
                    [key]: true,
                  }), {} as ModeratorPermissions);
                  onPermissionChange(pubkey, allPermissions);
                }}
                className="flex items-center gap-1"
              >
                <Unlock className="h-3 w-3" />
                Grant All
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // Set all permissions to false
                  const noPermissions = Object.keys(permissionLabels).reduce((acc, key) => ({
                    ...acc,
                    [key]: false,
                  }), {} as ModeratorPermissions);
                  onPermissionChange(pubkey, noPermissions);
                }}
                className="flex items-center gap-1"
              >
                <Lock className="h-3 w-3" />
                Revoke All
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ModerationPermissions({ communityId }: ModerationPermissionsProps) {
  const { canModerate, role } = useCanModerate(communityId);
  const { moderators, owner } = useCommunityModerators(communityId);
  const { mutate: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const { toast } = useToast();

  // Call useAuthor for owner at top level to avoid conditional hook calls
  const ownerAuthor = useAuthor(owner || '');

  const [permissions, setPermissions] = useState<Record<string, ModeratorPermissions>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize default permissions for moderators
  const getDefaultPermissions = (): ModeratorPermissions => ({
    canDeletePosts: true,
    canBanUsers: true,
    canMuteUsers: true,
    canPinPosts: true,
    canApproveContent: true,
    canManageChannels: false,
    canViewAnalytics: true,
    canManageRoles: false,
    canAccessSettings: false,
  });

  const handlePermissionChange = (pubkey: string, newPermissions: ModeratorPermissions) => {
    setPermissions(prev => ({
      ...prev,
      [pubkey]: newPermissions,
    }));
  };

  const savePermissions = async () => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to save permissions',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      const tags = [
        ['d', `moderator-permissions-${communityId}`],
        ['a', communityId],
        ['config_type', 'moderator_permissions'],
      ];

      createEvent(
        {
          kind: 30078, // Application-specific data
          content: JSON.stringify(permissions),
          tags,
        },
        {
          onSuccess: () => {
            toast({
              title: 'Permissions saved',
              description: 'Moderator permissions have been updated successfully.',
            });
          },
          onError: (_error) => {
            toast({
              title: 'Error saving permissions',
              description: 'Failed to save moderator permissions',
              variant: 'destructive',
            });
          },
        }
      );
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save moderator permissions',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!canModerate || role !== 'owner') {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Crown className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Owner Access Required</h3>
          <p className="text-muted-foreground">
            Only community owners can manage moderator permissions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Moderator Permissions
            <Badge variant="default">
              <Crown className="h-3 w-3 mr-1" />
              Owner Only
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Configure what actions each moderator can perform in your community.
            Fine-tune permissions to match your moderation strategy.
          </p>
        </CardContent>
      </Card>

      {/* Owner Card */}
      {owner && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={ownerAuthor.data?.metadata?.picture} />
                <AvatarFallback>
                  {genUserName(owner).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-medium">{ownerAuthor.data?.metadata?.name || genUserName(owner!)}</div>
                <div className="text-sm text-muted-foreground">
                  {owner.slice(0, 16)}...
                </div>
              </div>
              <Badge variant="default">
                <Crown className="h-3 w-3 mr-1" />
                Owner
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground text-center py-4">
              Community owners have all permissions by default
            </div>
          </CardContent>
        </Card>
      )}

      {/* Moderators */}
      {moderators.length > 0 ? (
        <div className="space-y-4">
          {moderators.map((pubkey) => (
            <ModeratorCard
              key={pubkey}
              pubkey={pubkey}
              _communityId={communityId}
              permissions={permissions[pubkey] || getDefaultPermissions()}
              onPermissionChange={handlePermissionChange}
              canEdit={true}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Moderators</h3>
            <p className="text-muted-foreground">
              Add moderators to your community to help with moderation tasks.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Permission Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Permission Templates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-dashed">
              <CardContent className="p-4 text-center">
                <h4 className="font-medium mb-2">Basic Moderator</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Can moderate content and users but not manage settings
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const basicPermissions = {
                      canDeletePosts: true,
                      canBanUsers: true,
                      canMuteUsers: true,
                      canPinPosts: true,
                      canApproveContent: true,
                      canManageChannels: false,
                      canViewAnalytics: true,
                      canManageRoles: false,
                      canAccessSettings: false,
                    };
                    moderators.forEach(pubkey => {
                      handlePermissionChange(pubkey, basicPermissions);
                    });
                  }}
                >
                  Apply to All
                </Button>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="p-4 text-center">
                <h4 className="font-medium mb-2">Senior Moderator</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Full moderation powers including channel management
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const seniorPermissions = {
                      canDeletePosts: true,
                      canBanUsers: true,
                      canMuteUsers: true,
                      canPinPosts: true,
                      canApproveContent: true,
                      canManageChannels: true,
                      canViewAnalytics: true,
                      canManageRoles: false,
                      canAccessSettings: true,
                    };
                    moderators.forEach(pubkey => {
                      handlePermissionChange(pubkey, seniorPermissions);
                    });
                  }}
                >
                  Apply to All
                </Button>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="p-4 text-center">
                <h4 className="font-medium mb-2">Content Moderator</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Focused on content approval and post management
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const contentPermissions = {
                      canDeletePosts: true,
                      canBanUsers: false,
                      canMuteUsers: true,
                      canPinPosts: true,
                      canApproveContent: true,
                      canManageChannels: false,
                      canViewAnalytics: true,
                      canManageRoles: false,
                      canAccessSettings: false,
                    };
                    moderators.forEach(pubkey => {
                      handlePermissionChange(pubkey, contentPermissions);
                    });
                  }}
                >
                  Apply to All
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {moderators.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <Button
              onClick={savePermissions}
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? 'Saving...' : 'Save Permission Changes'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}