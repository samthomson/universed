import { useState } from 'react';
import { VoiceChannel } from '@/components/voice/VoiceChannel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function VoiceDemo() {
  const { user } = useCurrentUser();
  const [channelId, setChannelId] = useState('demo-voice-channel');
  const [channelName, setChannelName] = useState('Demo Voice Channel');

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Voice Channel Demo</CardTitle>
            <CardDescription>
              Please log in to test voice channel functionality
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginArea className="w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Voice Channel Demo</h1>
        <p className="text-muted-foreground mt-2">
          Test the voice channel functionality with WebRTC audio streaming
        </p>
      </div>

      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Channel Settings</CardTitle>
          <CardDescription>
            Configure the demo voice channel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel-id">Channel ID</Label>
            <Input
              id="channel-id"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="demo-voice-channel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="channel-name">Channel Name</Label>
            <Input
              id="channel-name"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="Demo Voice Channel"
            />
          </div>
        </CardContent>
      </Card>

      <div className="max-w-md mx-auto">
        <VoiceChannel
          channelId={channelId}
          channelName={channelName}
        />
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>How to Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">1. Join the Voice Channel</h4>
            <p className="text-sm text-muted-foreground">
              Click the "Join" button to connect to the voice channel. You'll be prompted for microphone permission.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">2. Test with Multiple Users</h4>
            <p className="text-sm text-muted-foreground">
              Open this page in multiple browser tabs or have friends join with the same channel ID to test peer-to-peer audio.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">3. Voice Controls</h4>
            <p className="text-sm text-muted-foreground">
              Use the mute, deafen, and settings controls to test audio functionality. Speaking indicators should show when you talk.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">4. Technical Details</h4>
            <p className="text-sm text-muted-foreground">
              The implementation uses WebRTC for peer-to-peer audio streaming, with Nostr events for signaling and state management.
              Voice activity detection shows speaking indicators, and all audio processing includes noise suppression and echo cancellation.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}