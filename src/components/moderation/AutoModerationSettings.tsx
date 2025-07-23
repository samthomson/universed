import { useState } from 'react';
import { Bot, Shield, AlertTriangle, CheckCircle, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useCanModerate } from '@/hooks/useCommunityRoles';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';

interface AutoModerationSettingsProps {
  communityId: string;
}

interface AutoModerationConfig {
  enabled: boolean;
  spamDetection: {
    enabled: boolean;
    threshold: number;
    action: 'flag' | 'mute' | 'ban';
  };
  profanityFilter: {
    enabled: boolean;
    customWords: string[];
    action: 'flag' | 'delete' | 'mute';
  };
  linkValidation: {
    enabled: boolean;
    allowedDomains: string[];
    blockSuspiciousLinks: boolean;
  };
  rateLimit: {
    enabled: boolean;
    maxPostsPerHour: number;
    maxPostsPerDay: number;
  };
  newUserRestrictions: {
    enabled: boolean;
    requireApproval: boolean;
    restrictionDays: number;
  };
  contentFilters: {
    minPostLength: number;
    maxPostLength: number;
    requireImages: boolean;
    blockDuplicates: boolean;
  };
}

export function AutoModerationSettings({ communityId }: AutoModerationSettingsProps) {
  const { canModerate } = useCanModerate(communityId);
  const { mutate: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const { toast } = useToast();

  const [config, setConfig] = useState<AutoModerationConfig>({
    enabled: false,
    spamDetection: {
      enabled: true,
      threshold: 5,
      action: 'flag',
    },
    profanityFilter: {
      enabled: false,
      customWords: [],
      action: 'flag',
    },
    linkValidation: {
      enabled: true,
      allowedDomains: [],
      blockSuspiciousLinks: true,
    },
    rateLimit: {
      enabled: true,
      maxPostsPerHour: 10,
      maxPostsPerDay: 50,
    },
    newUserRestrictions: {
      enabled: false,
      requireApproval: true,
      restrictionDays: 7,
    },
    contentFilters: {
      minPostLength: 1,
      maxPostLength: 5000,
      requireImages: false,
      blockDuplicates: true,
    },
  });

  const [newWord, setNewWord] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveConfig = async () => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to save settings',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      const tags = [
        ['d', `auto-moderation-${communityId}`],
        ['a', communityId],
        ['config_type', 'auto_moderation'],
      ];

      createEvent(
        {
          kind: 30078, // Application-specific data
          content: JSON.stringify(config),
          tags,
        },
        {
          onSuccess: () => {
            toast({
              title: 'Settings saved',
              description: 'Auto-moderation settings have been updated successfully.',
            });
          },
          onError: (_error) => {
            toast({
              title: 'Error saving settings',
              description: 'Failed to save auto-moderation settings',
              variant: 'destructive',
            });
          },
        }
      );
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save auto-moderation settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addCustomWord = () => {
    if (newWord.trim() && !config.profanityFilter.customWords.includes(newWord.trim())) {
      setConfig(prev => ({
        ...prev,
        profanityFilter: {
          ...prev.profanityFilter,
          customWords: [...prev.profanityFilter.customWords, newWord.trim()],
        },
      }));
      setNewWord('');
    }
  };

  const removeCustomWord = (word: string) => {
    setConfig(prev => ({
      ...prev,
      profanityFilter: {
        ...prev.profanityFilter,
        customWords: prev.profanityFilter.customWords.filter(w => w !== word),
      },
    }));
  };

  const _addAllowedDomain = () => {
    if (newDomain.trim() && !config.linkValidation.allowedDomains.includes(newDomain.trim())) {
      setConfig(prev => ({
        ...prev,
        linkValidation: {
          ...prev.linkValidation,
          allowedDomains: [...prev.linkValidation.allowedDomains, newDomain.trim()],
        },
      }));
      setNewDomain('');
    }
  };

  const _removeAllowedDomain = (domain: string) => {
    setConfig(prev => ({
      ...prev,
      linkValidation: {
        ...prev.linkValidation,
        allowedDomains: prev.linkValidation.allowedDomains.filter(d => d !== domain),
      },
    }));
  };

  if (!canModerate) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to configure auto-moderation settings.
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
            <Bot className="h-5 w-5" />
            Auto-Moderation Settings
            <Badge variant={config.enabled ? 'default' : 'secondary'}>
              {config.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Enable Auto-Moderation</Label>
              <p className="text-sm text-muted-foreground">
                Automatically detect and handle problematic content using AI and rule-based filters
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enabled: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      {config.enabled && (
        <>
          {/* Spam Detection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Spam Detection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Enable Spam Detection</Label>
                  <p className="text-sm text-muted-foreground">
                    Detect repetitive, promotional, or low-quality content
                  </p>
                </div>
                <Switch
                  checked={config.spamDetection.enabled}
                  onCheckedChange={(checked) => setConfig(prev => ({
                    ...prev,
                    spamDetection: { ...prev.spamDetection, enabled: checked }
                  }))}
                />
              </div>

              {config.spamDetection.enabled && (
                <div className="space-y-4 ml-4 border-l-2 border-muted pl-4">
                  <div className="space-y-2">
                    <Label htmlFor="spam-threshold">Spam Threshold (1-10)</Label>
                    <Input
                      id="spam-threshold"
                      type="number"
                      min="1"
                      max="10"
                      value={config.spamDetection.threshold}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        spamDetection: { ...prev.spamDetection, threshold: parseInt(e.target.value) || 5 }
                      }))}
                      className="w-32"
                    />
                    <p className="text-xs text-muted-foreground">
                      Higher values are more strict (1 = lenient, 10 = strict)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Action for Spam</Label>
                    <Select
                      value={config.spamDetection.action}
                      onValueChange={(value) => setConfig(prev => ({
                        ...prev,
                        spamDetection: { ...prev.spamDetection, action: value as 'flag' | 'mute' | 'ban' }
                      }))}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flag">Flag for Review</SelectItem>
                        <SelectItem value="mute">Mute User (24h)</SelectItem>
                        <SelectItem value="ban">Ban User</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Profanity Filter */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Profanity Filter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Enable Profanity Filter</Label>
                  <p className="text-sm text-muted-foreground">
                    Filter out inappropriate language and custom blocked words
                  </p>
                </div>
                <Switch
                  checked={config.profanityFilter.enabled}
                  onCheckedChange={(checked) => setConfig(prev => ({
                    ...prev,
                    profanityFilter: { ...prev.profanityFilter, enabled: checked }
                  }))}
                />
              </div>

              {config.profanityFilter.enabled && (
                <div className="space-y-4 ml-4 border-l-2 border-muted pl-4">
                  <div className="space-y-2">
                    <Label>Action for Profanity</Label>
                    <Select
                      value={config.profanityFilter.action}
                      onValueChange={(value) => setConfig(prev => ({
                        ...prev,
                        profanityFilter: { ...prev.profanityFilter, action: value as 'flag' | 'delete' | 'mute' }
                      }))}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flag">Flag for Review</SelectItem>
                        <SelectItem value="delete">Delete Post</SelectItem>
                        <SelectItem value="mute">Mute User (24h)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Custom Blocked Words</Label>
                    <div className="flex gap-2">
                      <Input
                        value={newWord}
                        onChange={(e) => setNewWord(e.target.value)}
                        placeholder="Add a word to block..."
                        onKeyPress={(e) => e.key === 'Enter' && addCustomWord()}
                      />
                      <Button onClick={addCustomWord} disabled={!newWord.trim()}>
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {config.profanityFilter.customWords.map((word) => (
                        <Badge key={word} variant="outline" className="cursor-pointer" onClick={() => removeCustomWord(word)}>
                          {word} ×
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rate Limiting */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Rate Limiting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Enable Rate Limiting</Label>
                  <p className="text-sm text-muted-foreground">
                    Limit how frequently users can post to prevent spam
                  </p>
                </div>
                <Switch
                  checked={config.rateLimit.enabled}
                  onCheckedChange={(checked) => setConfig(prev => ({
                    ...prev,
                    rateLimit: { ...prev.rateLimit, enabled: checked }
                  }))}
                />
              </div>

              {config.rateLimit.enabled && (
                <div className="grid grid-cols-2 gap-4 ml-4 border-l-2 border-muted pl-4">
                  <div className="space-y-2">
                    <Label htmlFor="max-posts-hour">Max Posts per Hour</Label>
                    <Input
                      id="max-posts-hour"
                      type="number"
                      min="1"
                      max="100"
                      value={config.rateLimit.maxPostsPerHour}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        rateLimit: { ...prev.rateLimit, maxPostsPerHour: parseInt(e.target.value) || 10 }
                      }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max-posts-day">Max Posts per Day</Label>
                    <Input
                      id="max-posts-day"
                      type="number"
                      min="1"
                      max="1000"
                      value={config.rateLimit.maxPostsPerDay}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        rateLimit: { ...prev.rateLimit, maxPostsPerDay: parseInt(e.target.value) || 50 }
                      }))}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Content Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Content Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min-length">Minimum Post Length</Label>
                  <Input
                    id="min-length"
                    type="number"
                    min="1"
                    max="1000"
                    value={config.contentFilters.minPostLength}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      contentFilters: { ...prev.contentFilters, minPostLength: parseInt(e.target.value) || 1 }
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-length">Maximum Post Length</Label>
                  <Input
                    id="max-length"
                    type="number"
                    min="100"
                    max="10000"
                    value={config.contentFilters.maxPostLength}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      contentFilters: { ...prev.contentFilters, maxPostLength: parseInt(e.target.value) || 5000 }
                    }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Block Duplicate Posts</Label>
                  <p className="text-sm text-muted-foreground">
                    Prevent users from posting identical content multiple times
                  </p>
                </div>
                <Switch
                  checked={config.contentFilters.blockDuplicates}
                  onCheckedChange={(checked) => setConfig(prev => ({
                    ...prev,
                    contentFilters: { ...prev.contentFilters, blockDuplicates: checked }
                  }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Card>
            <CardContent className="pt-6">
              <Button
                onClick={handleSaveConfig}
                disabled={isSaving}
                className="w-full"
              >
                {isSaving ? 'Saving...' : 'Save Auto-Moderation Settings'}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}