import { useState } from 'react';
import { Settings, Save, Shield, Eye, MessageSquare, Hash, Bot } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useCommunities } from '@/hooks/useCommunities';
import { useCanModerate } from '@/hooks/useCommunityRoles';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { AutoModerationSettings } from './AutoModerationSettings';

interface CommunitySettingsProps {
  communityId: string;
}

export function CommunitySettings({ communityId }: CommunitySettingsProps) {
  const { data: communities } = useCommunities();
  const { canModerate, role } = useCanModerate(communityId);
  const { mutate: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const { toast } = useToast();

  const community = communities?.find(c => c.id === communityId);

  const [settings, setSettings] = useState({
    name: community?.name || '',
    about: community?.description || '',
    picture: community?.image || '',
    banner: community?.banner || '',
    rules: [] as string[],
    moderationPolicy: 'moderate', // strict, moderate, relaxed
    requireApproval: false,
    allowAnonymous: true,
    maxPostLength: 280,
    allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif'],
    autoModeration: {
      enabled: false,
      spamDetection: true,
      profanityFilter: false,
      linkValidation: true,
    },
    notifications: {
      newMembers: true,
      newPosts: false,
      reports: true,
      mentions: true,
    },
  });

  const [newRule, setNewRule] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSettings = async () => {
    if (!user || !community) {
      toast({
        title: 'Error',
        description: 'Unable to save settings',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      // Update community definition with new settings
      const tags = [
        ['d', community.id.split(':')[2]], // Extract d-tag
        ['name', settings.name],
        ['about', settings.about],
        ['picture', settings.picture],
        ['banner', settings.banner],
        ['moderation_policy', settings.moderationPolicy],
        ['require_approval', settings.requireApproval.toString()],
        ['allow_anonymous', settings.allowAnonymous.toString()],
        ['max_post_length', settings.maxPostLength.toString()],
        ...settings.rules.map(rule => ['rule', rule]),
        ...settings.allowedFileTypes.map(type => ['allowed_file_type', type]),
        ['auto_moderation', JSON.stringify(settings.autoModeration)],
        ['notifications', JSON.stringify(settings.notifications)],
      ];

      // Add existing moderators
      if (community.moderators) {
        community.moderators.forEach(pubkey => {
          tags.push(['p', pubkey, '', 'moderator']);
        });
      }

      createEvent(
        {
          kind: 34550,
          content: JSON.stringify({
            name: settings.name,
            about: settings.about,
            picture: settings.picture,
            banner: settings.banner,
          }),
          tags,
        },
        {
          onSuccess: () => {
            toast({
              title: 'Settings saved',
              description: 'Community settings have been updated successfully.',
            });
          },
          onError: (_error) => {
            toast({
              title: 'Error saving settings',
              description: 'Failed to save community settings',
              variant: 'destructive',
            });
          },
        }
      );
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save community settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddRule = () => {
    if (newRule.trim()) {
      setSettings(prev => ({
        ...prev,
        rules: [...prev.rules, newRule.trim()],
      }));
      setNewRule('');
    }
  };

  const handleRemoveRule = (index: number) => {
    setSettings(prev => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index),
    }));
  };

  if (!canModerate) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to modify community settings.
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
            <Settings className="h-5 w-5" />
            Community Settings
            <Badge variant={role === 'owner' ? 'default' : 'secondary'}>
              {role}
            </Badge>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Community Name</Label>
              <Input
                id="name"
                value={settings.name}
                onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter community name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="picture">Picture URL</Label>
              <Input
                id="picture"
                value={settings.picture}
                onChange={(e) => setSettings(prev => ({ ...prev, picture: e.target.value }))}
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="about">Description</Label>
            <Textarea
              id="about"
              value={settings.about}
              onChange={(e) => setSettings(prev => ({ ...prev, about: e.target.value }))}
              placeholder="Describe your community..."
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="banner">Banner URL</Label>
            <Input
              id="banner"
              value={settings.banner}
              onChange={(e) => setSettings(prev => ({ ...prev, banner: e.target.value }))}
              placeholder="https://example.com/banner.jpg"
            />
          </div>
        </CardContent>
      </Card>

      {/* Community Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Community Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {settings.rules.map((rule, index) => (
              <div key={index} className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <span className="flex-1 text-sm">{index + 1}. {rule}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemoveRule(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              placeholder="Add a new rule..."
              onKeyPress={(e) => e.key === 'Enter' && handleAddRule()}
            />
            <Button onClick={handleAddRule} disabled={!newRule.trim()}>
              Add Rule
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Moderation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Moderation Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Moderation Policy</Label>
              <Select
                value={settings.moderationPolicy}
                onValueChange={(value) => setSettings(prev => ({ ...prev, moderationPolicy: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strict">Strict - All content requires approval</SelectItem>
                  <SelectItem value="moderate">Moderate - Automatic moderation with manual review</SelectItem>
                  <SelectItem value="relaxed">Relaxed - Minimal moderation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Require Post Approval</Label>
                <p className="text-sm text-muted-foreground">
                  All posts must be approved by moderators before being visible
                </p>
              </div>
              <Switch
                checked={settings.requireApproval}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, requireApproval: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Allow Anonymous Posts</Label>
                <p className="text-sm text-muted-foreground">
                  Allow users to post without revealing their identity
                </p>
              </div>
              <Switch
                checked={settings.allowAnonymous}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, allowAnonymous: checked }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxLength">Maximum Post Length</Label>
              <Input
                id="maxLength"
                type="number"
                value={settings.maxPostLength}
                onChange={(e) => setSettings(prev => ({ ...prev, maxPostLength: parseInt(e.target.value) || 280 }))}
                min="1"
                max="5000"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium">Auto-Moderation</h4>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Enable Auto-Moderation</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically detect and handle problematic content
                </p>
              </div>
              <Switch
                checked={settings.autoModeration.enabled}
                onCheckedChange={(checked) => setSettings(prev => ({
                  ...prev,
                  autoModeration: { ...prev.autoModeration, enabled: checked }
                }))}
              />
            </div>

            {settings.autoModeration.enabled && (
              <div className="ml-4 space-y-3 border-l-2 border-muted pl-4">
                <div className="flex items-center justify-between">
                  <Label>Spam Detection</Label>
                  <Switch
                    checked={settings.autoModeration.spamDetection}
                    onCheckedChange={(checked) => setSettings(prev => ({
                      ...prev,
                      autoModeration: { ...prev.autoModeration, spamDetection: checked }
                    }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Profanity Filter</Label>
                  <Switch
                    checked={settings.autoModeration.profanityFilter}
                    onCheckedChange={(checked) => setSettings(prev => ({
                      ...prev,
                      autoModeration: { ...prev.autoModeration, profanityFilter: checked }
                    }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Link Validation</Label>
                  <Switch
                    checked={settings.autoModeration.linkValidation}
                    onCheckedChange={(checked) => setSettings(prev => ({
                      ...prev,
                      autoModeration: { ...prev.autoModeration, linkValidation: checked }
                    }))}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Notification Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>New Members</Label>
              <p className="text-sm text-muted-foreground">
                Notify when new users join the community
              </p>
            </div>
            <Switch
              checked={settings.notifications.newMembers}
              onCheckedChange={(checked) => setSettings(prev => ({
                ...prev,
                notifications: { ...prev.notifications, newMembers: checked }
              }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>New Posts</Label>
              <p className="text-sm text-muted-foreground">
                Notify when new posts are created
              </p>
            </div>
            <Switch
              checked={settings.notifications.newPosts}
              onCheckedChange={(checked) => setSettings(prev => ({
                ...prev,
                notifications: { ...prev.notifications, newPosts: checked }
              }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Reports</Label>
              <p className="text-sm text-muted-foreground">
                Notify when content is reported
              </p>
            </div>
            <Switch
              checked={settings.notifications.reports}
              onCheckedChange={(checked) => setSettings(prev => ({
                ...prev,
                notifications: { ...prev.notifications, reports: checked }
              }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Mentions</Label>
              <p className="text-sm text-muted-foreground">
                Notify when the community is mentioned
              </p>
            </div>
            <Switch
              checked={settings.notifications.mentions}
              onCheckedChange={(checked) => setSettings(prev => ({
                ...prev,
                notifications: { ...prev.notifications, mentions: checked }
              }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Auto-Moderation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Auto-Moderation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Configure automated moderation rules and filters to help maintain community standards.
          </p>
          <AutoModerationSettings communityId={communityId} />
        </CardContent>
      </Card>

      {/* Save Button */}
      <Card>
        <CardContent className="pt-6">
          <Button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="w-full flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}