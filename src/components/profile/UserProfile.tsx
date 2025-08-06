import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, UserPlus, MoreHorizontal, Calendar, Link as LinkIcon, Copy, Check, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserPosts } from "@/hooks/useUserPosts";
import { genUserName } from "@/lib/genUserName";
import { formatDistanceToNow } from "date-fns";
import { nip19 } from "nostr-tools";
import { MessageItem } from "@/components/chat/MessageItem";
import { NewDMDialog } from "@/components/dm/NewDMDialog";
import { toast } from "sonner";

interface UserProfileProps {
  pubkey: string;
}

export function UserProfile({ pubkey }: UserProfileProps) {
  const [showNewDM, setShowNewDM] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  const { data: posts, isLoading: isLoadingPosts } = useUserPosts(pubkey);

  const displayName = metadata?.name || genUserName(pubkey);
  const profileImage = metadata?.picture;
  const banner = metadata?.banner;
  const about = metadata?.about;
  const website = metadata?.website;
  const nip05 = metadata?.nip05;
  const npub = nip19.npubEncode(pubkey);

  const isOwnProfile = user?.pubkey === pubkey;
  const joinDate = author.data?.event ? new Date(author.data.event.created_at * 1000) : null;

  const handleStartDM = () => {
    setShowNewDM(true);
  };

  const handleCopyNpub = async () => {
    try {
      await navigator.clipboard.writeText(npub);
      setCopied(true);
      toast.success("Copied npub to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy npub");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Header */}
      <Card>
        {/* Banner */}
        {banner && (
          <div className="h-48 bg-cover bg-center rounded-t-lg" style={{ backgroundImage: `url(${banner})` }} />
        )}

        <CardHeader className="relative">
          {/* Avatar */}
          <div className={`flex items-start justify-between ${banner ? '-mt-16' : ''}`}>
            <Avatar className={`w-32 h-32 border-4 border-gray-800 ${banner ? 'mb-4' : ''}`}>
              <AvatarImage src={profileImage} alt={displayName} />
              <AvatarFallback className="bg-indigo-600 text-white text-2xl">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* Action Buttons */}
            {isOwnProfile ? (
              <div className="flex items-center space-x-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    navigate(`/profile/${npub}/edit`);
                  }}
                  className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit Profile</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartDM}
                  className="flex items-center space-x-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Message</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Follow</span>
                </Button>
                <Button variant="ghost" size="icon" className="w-8 h-8">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{displayName}</h1>
              <div className="flex items-center space-x-2 mt-1">
                <p className="text-gray-400">@{npub.slice(0, 16)}...</p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyNpub}
                  className="h-7 w-7 hover:bg-gray-700"
                  title="Copy npub"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>
              {nip05 && (
                <Badge variant="secondary" className="mt-2">
                  ✓ {nip05}
                </Badge>
              )}
            </div>

            {about && (
              <p className="text-gray-300 max-w-2xl">{about}</p>
            )}

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
              {website && (
                <div className="flex items-center space-x-1">
                  <LinkIcon className="w-4 h-4" />
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:underline"
                  >
                    {website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}

              {joinDate && (
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>Joined {formatDistanceToNow(joinDate, { addSuffix: true })}</span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center space-x-6 text-sm">
              <div>
                <span className="font-semibold text-white">{posts?.length || 0}</span>
                <span className="text-gray-400 ml-1">Posts</span>
              </div>
              <div>
                <span className="font-semibold text-white">0</span>
                <span className="text-gray-400 ml-1">Following</span>
              </div>
              <div>
                <span className="font-semibold text-white">0</span>
                <span className="text-gray-400 ml-1">Followers</span>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Profile Content */}
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gray-700">
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="replies">Replies</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-4">
          {isLoadingPosts ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="flex space-x-3">
                      <div className="w-10 h-10 bg-gray-600 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-600 rounded w-1/4" />
                        <div className="h-4 bg-gray-600 rounded w-full" />
                        <div className="h-4 bg-gray-600 rounded w-3/4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : posts && posts.length > 0 ? (
            <div className="space-y-4">
              {posts.map((post) => (
                <Card key={post.id}>
                  <CardContent className="p-0">
                    <MessageItem message={post} showAvatar={true} />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-gray-400">
                <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
                <p className="text-sm">
                  {isOwnProfile ? "Share your first post!" : `${displayName} hasn't posted anything yet.`}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="replies">
          <Card>
            <CardContent className="p-8 text-center text-gray-400">
              <h3 className="text-lg font-semibold mb-2">No replies yet</h3>
              <p className="text-sm">Replies will appear here</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media">
          <Card>
            <CardContent className="p-8 text-center text-gray-400">
              <h3 className="text-lg font-semibold mb-2">No media yet</h3>
              <p className="text-sm">Photos and videos will appear here</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New DM Dialog */}
      <NewDMDialog
        open={showNewDM}
        onOpenChange={setShowNewDM}
        onConversationCreated={() => {
          // TODO: Navigate to DM conversation
          console.log('Started DM with:', pubkey);
        }}
      />
    </div>
  );
}