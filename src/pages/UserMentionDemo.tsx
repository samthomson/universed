import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageInput } from "@/components/chat/MessageInput";
import { NoteContent } from "@/components/NoteContent";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { LoginArea } from "@/components/auth/LoginArea";
import type { NostrEvent } from "@nostrify/nostrify";

export function UserMentionDemo() {
  const { user } = useCurrentUser();
  const [demoMessages, setDemoMessages] = useState<NostrEvent[]>([]);

  // Mock community ID for demo purposes
  const mockCommunityId = "34550:demo-pubkey:demo-community";
  const mockChannelId = "general";

  const _handleNewMessage = (event: NostrEvent) => {
    setDemoMessages(prev => [...prev, event]);
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>User Mention Demo</CardTitle>
            <CardDescription>
              Please log in to test the user mention functionality
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <LoginArea className="max-w-60" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>User Mention Demo</CardTitle>
          <CardDescription>
            Test the user tagging functionality by typing @ in the message input below.
            This will show an autocomplete with community members you can mention.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">How to use:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Type @ followed by a name to start mentioning a user</li>
              <li>Use arrow keys to navigate the autocomplete suggestions</li>
              <li>Press Enter or click to select a user</li>
              <li>The mention will be inserted in @[DisplayName](pubkey) format</li>
              <li>When the message is sent, p tags are automatically added for mentioned users</li>
            </ol>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Try it out:</h3>
            <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
              <p className="text-sm text-muted-foreground mb-3">
                Type <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">@</code> followed by a name like "alice", "bob", or "charlie" to see the autocomplete:
              </p>
              <MessageInput
                communityId={mockCommunityId}
                channelId={mockChannelId}
                placeholder="Type @alice or @bob to test..."
              />
            </div>
          </div>

          {demoMessages.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Demo Messages:</h3>
              <div className="space-y-2">
                {demoMessages.map((message, index) => (
                  <Card key={index} className="p-4">
                    <NoteContent event={message} />

                    {/* Show the raw tags for demonstration */}
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer">
                        Show raw event data
                      </summary>
                      <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto">
                        {JSON.stringify(message, null, 2)}
                      </pre>
                    </details>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Technical Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Mention Format</h4>
            <p className="text-sm text-muted-foreground">
              User mentions are stored in the message content using the format: <code>@[DisplayName](pubkey)</code>
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Nostr Tags</h4>
            <p className="text-sm text-muted-foreground">
              For each mentioned user, a p tag is automatically added: <code>["p", "pubkey"]</code>
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Autocomplete Source</h4>
            <p className="text-sm text-muted-foreground">
              The autocomplete suggestions come from community members, including owners, moderators, and regular members.
              Online status is indicated with a green dot.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}