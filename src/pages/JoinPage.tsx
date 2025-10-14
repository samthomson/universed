import { useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUrlNavigation } from "@/hooks/useUrlNavigation";
import { useNavigate } from "react-router-dom";
import { LoginArea } from "@/components/auth/LoginArea";
import { useNostr } from "@nostrify/react";
import { useQuery } from "@tanstack/react-query";
import type { NostrEvent } from "@nostrify/nostrify";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthor } from "@/hooks/useAuthor";
import { useJoinCommunity } from "@/hooks/useJoinCommunity";
import { useToast } from "@/hooks/useToast";
import { genUserName } from "@/lib/genUserName";
import { Users, Crown } from "lucide-react";
import { useDataManager } from "@/components/DataManagerProvider";

// Page component for Join flow pages
export function JoinPage() {
	const { user } = useCurrentUser();
	const { communityId, isJoinRequest, naddr } = useUrlNavigation();
	const { nostr } = useNostr();
	const { mutate: joinCommunity, isPending: isJoining } = useJoinCommunity();
	const { toast } = useToast();
	const navigate = useNavigate();
	const [joinMessage, setJoinMessage] = useState("");
	const { communities } = useDataManager();

	// Show message if not logged in
	if (!user) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="text-center max-w-md p-8 space-y-6">
					<div>
						<h2 className="text-2xl font-bold mb-4">Join Community</h2>
						<p className="text-muted-foreground mb-6">
							Please log in to join this community.
						</p>
					</div>
					<LoginArea className="flex w-full" />
				</div>
			</div>
		);
	}

	if (!isJoinRequest || !communityId || !naddr) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="text-center max-w-md p-8">
					<h2 className="text-2xl font-bold mb-4">Invalid Join Link</h2>
					<p className="text-muted-foreground">
						The join link you followed is invalid or expired.
					</p>
				</div>
			</div>
		);
	}

	// Fetch the community event directly from the naddr
	const { data: communityEvent, isLoading } = useQuery({
		queryKey: ["community-join", communityId],
		queryFn: async (c) => {
			const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
			const [kind, pubkey, identifier] = communityId.split(":");
			
			const events = await nostr.query(
				[{
					kinds: [parseInt(kind)],
					authors: [pubkey],
					"#d": [identifier],
					limit: 1,
				}],
				{ signal }
			);

			return events[0] as NostrEvent | undefined;
		},
		enabled: !!communityId,
	});

	const communityInfo = communityEvent ? {
		id: communityEvent.tags.find(([name]) => name === "d")?.[1] || "",
		name: communityEvent.tags.find(([name]) => name === "name")?.[1] || "Unnamed Community",
		description: communityEvent.tags.find(([name]) => name === "description")?.[1] || "",
		image: communityEvent.tags.find(([name]) => name === "image")?.[1],
		creator: communityEvent.pubkey,
	} : null;

	const creatorAuthor = useAuthor(communityInfo?.creator || "");
	const creatorMetadata = creatorAuthor.data?.metadata;

	const handleJoinRequest = () => {
		if (!communityId) return;

		joinCommunity(
			{
				communityId,
				message: joinMessage.trim() || `I would like to join ${communityInfo?.name || "this community"}.`,
			},
			{
				onSuccess: async () => {
					toast({
						title: "Join Request Sent",
						description: "Your request to join the community has been sent to the moderators.",
					});
					// Add the community with pending status to DataManager
					await communities.addProspectiveCommunity(communityId);
					// Navigate to the community page to show pending state
					setTimeout(() => {
						navigate(`/space/${communityId}`);
					}, 500);
				},
				onError: (error) => {
					toast({
						title: "Failed to Send Request",
						description: error instanceof Error ? error.message : "An error occurred while sending your request.",
						variant: "destructive",
					});
				},
			}
		);
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<Card className="w-full max-w-2xl">
					<CardHeader>
						<Skeleton className="h-8 w-48" />
						<Skeleton className="h-4 w-full mt-2" />
					</CardHeader>
					<CardContent className="space-y-4">
						<Skeleton className="h-24 w-full" />
						<Skeleton className="h-10 w-full" />
					</CardContent>
				</Card>
			</div>
		);
	}

	if (!communityEvent || !communityInfo) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="text-center max-w-md p-8">
					<h2 className="text-2xl font-bold mb-4">Community Not Found</h2>
					<p className="text-muted-foreground mb-6">
						The community you're trying to join could not be found.
					</p>
					<Button onClick={() => navigate("/")}>Go Home</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background flex items-center justify-center p-4">
			<Card className="w-full max-w-2xl">
				<CardHeader>
					<div className="flex items-start gap-4">
						{communityInfo.image && (
							<img
								src={communityInfo.image}
								alt={communityInfo.name}
								className="w-16 h-16 rounded-lg object-cover"
							/>
						)}
						<div className="flex-1">
							<CardTitle className="text-2xl flex items-center gap-2">
								<Users className="h-6 w-6" />
								{communityInfo.name}
							</CardTitle>
							{communityInfo.description && (
								<CardDescription className="mt-2">
									{communityInfo.description}
								</CardDescription>
							)}
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Creator Info */}
					<div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
						<Avatar className="h-10 w-10">
							<AvatarImage src={creatorMetadata?.picture} />
							<AvatarFallback>
								{(creatorMetadata?.name || genUserName(communityInfo.creator)).substring(0, 2).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<div className="flex-1">
							<p className="text-sm font-medium flex items-center gap-2">
								<Crown className="h-4 w-4 text-yellow-500" />
								{creatorMetadata?.name || genUserName(communityInfo.creator)}
							</p>
							<p className="text-xs text-muted-foreground">Community Owner</p>
						</div>
					</div>

					{/* Join Message */}
					<div className="space-y-2">
						<Label htmlFor="join-message">
							Message to Moderators (Optional)
						</Label>
						<Textarea
							id="join-message"
							placeholder={`I would like to join ${communityInfo.name}...`}
							value={joinMessage}
							onChange={(e) => setJoinMessage(e.target.value)}
							rows={4}
							className="resize-none"
						/>
						<p className="text-xs text-muted-foreground">
							Introduce yourself and explain why you'd like to join this community.
						</p>
					</div>

					{/* Action Buttons */}
					<div className="flex gap-3">
						<Button
							onClick={handleJoinRequest}
							disabled={isJoining}
							className="flex-1"
						>
							{isJoining ? "Sending Request..." : "Request to Join"}
						</Button>
						<Button
							variant="outline"
							onClick={() => navigate("/")}
						>
							Cancel
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

export default JoinPage;
