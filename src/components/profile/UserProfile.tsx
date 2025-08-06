import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Check,
  Copy,
  Edit,
  Link as LinkIcon,
  MessageCircle,
  MoreHorizontal,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserPosts } from "@/hooks/useUserPosts";
import { genUserName } from "@/lib/genUserName";
import { formatDistanceToNowShort } from "@/lib/formatTime";
import { nip19 } from "nostr-tools";
import { BaseMessageItem } from "@/components/messaging/BaseMessageItem";
import { groupMessageItemConfig } from "@/components/messaging/configs/groupConfig";
import { NewDMDialog } from "@/components/dm/NewDMDialog";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

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
  const joinDate = author.data?.event
    ? new Date(author.data.event.created_at * 1000)
    : null;

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
      <Card>
        {banner && (
          <div
            className="h-48 bg-cover bg-center rounded-t-lg"
            style={{ backgroundImage: `url(${banner})` }}
          />
        )}
        <CardHeader className="relative">
          <div
            className={`flex items-start justify-between ${
              banner ? "-mt-16" : ""
            }`}
          >
            <Avatar
              className={`w-32 h-32 border-4 border-card ${
                banner ? "mb-4" : ""
              }`}
            >
              <AvatarImage src={profileImage} alt={displayName} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {isOwnProfile
              ? (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      navigate(`/profile/${npub}/edit`);
                    }}
                    className="flex items-center space-x-2"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit Profile</span>
                  </Button>
                </div>
              )
              : (
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

          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold">{displayName}</h1>
              <div className="flex items-center space-x-2 mt-1">
                <p className="text-muted-foreground">@{npub.slice(0, 16)}...</p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyNpub}
                  className="h-7 w-7"
                  title="Copy npub"
                >
                  {copied
                    ? <Check className="h-4 w-4 text-green-500" />
                    : <Copy className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
              {nip05 && (
                <Badge variant="secondary" className="mt-2">
                  ✓ {nip05}
                </Badge>
              )}
            </div>

            {about && <p className="text-foreground/80 max-w-2xl">{about}</p>}

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {website && (
                <div className="flex items-center space-x-1">
                  <LinkIcon className="w-4 h-4" />
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {website.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}
              {joinDate && (
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Joined{" "}
                    {formatDistanceToNowShort(joinDate, { addSuffix: true })}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-6 text-sm">
              {/* Stats placeholders */}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="replies">Replies</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-4">
          {isLoadingPosts
            ? <div>{/* Skeleton for posts */}</div>
            : posts && posts.length > 0
            ? (
              <div className="space-y-4">
                {posts.map((post) => (
                  <Card key={post.id}>
                    <CardContent className="p-0">
                      <BaseMessageItem
                        message={post}
                        showAvatar={true}
                        config={groupMessageItemConfig}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
            : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
                </CardContent>
              </Card>
            )}
        </TabsContent>

        <TabsContent value="replies">
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <p>No replies yet</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="media">
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <p>No media yet</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <NewDMDialog
        open={showNewDM}
        onOpenChange={setShowNewDM}
        onConversationCreated={() => logger.log("Started DM with:", pubkey)}
      />
    </div>
  );
}
