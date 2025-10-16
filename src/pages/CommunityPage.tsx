import { useState, useEffect, useMemo, useCallback } from "react";
import { CommunityPanel } from "@/components/layout/CommunityPanel";
import { ChatArea } from "@/components/layout/ChatArea";
import { MemberList } from "@/components/layout/MemberList";
import { BasePageLayout } from "@/components/layout/BasePageLayout";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { decodeNaddrFromUrl, naddrToCommunityId } from "@/lib/utils";
import { useDataManager } from "@/components/DataManagerProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginArea } from "@/components/auth/LoginArea";
import { CommunityShareDialog } from "@/components/community/CommunityShareDialog";
import { useNostr } from "@nostrify/react";
import { useQuery } from "@tanstack/react-query";
import type { NostrEvent } from "@nostrify/nostrify";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthor } from "@/hooks/useAuthor";
import { useJoinCommunity } from "@/hooks/useJoinCommunity";
import { useToast } from "@/hooks/useToast";
import { genUserName } from "@/lib/genUserName";
import { Users, Crown } from "lucide-react";

// Page component for Community pages
export function CommunityPage() {
	const { communityId, channelId } = useParams<{ communityId: string; channelId?: string }>();
	const { user } = useCurrentUser();
	const navigate = useNavigate();
	const { communities } = useDataManager();
	const [searchParams, setSearchParams] = useSearchParams();
	const { nostr } = useNostr();
	const { mutate: joinCommunity, isPending: isJoining } = useJoinCommunity();
	const { toast } = useToast();

	const [selectedChannel, setSelectedChannel] = useState<string | null>(channelId || null);
	const [showMemberList, setShowMemberList] = useState(true);
	const [showShareDialog, setShowShareDialog] = useState(false);
	const [joinMessage, setJoinMessage] = useState("");

	// Memoize community ID decoding - only recalculate when URL parameter changes
	const decodedCommunityId = useMemo(() => {
		if (!communityId) return '';
		if (communityId.startsWith('naddr1')) {
			try {
				const naddr = decodeNaddrFromUrl(communityId);
				return naddrToCommunityId(naddr);
			} catch {
				console.error('Failed to decode naddr');
				return communityId;
			}
		}
		return communityId;
	}, [communityId]);

	// Memoize simple community ID extraction
	const simpleCommunityId = useMemo(() => {
		if (!decodedCommunityId) return '';
		if (decodedCommunityId.includes(':')) {
			// Full addressable format: "34550:pubkey:identifier" -> "identifier"
			const parts = decodedCommunityId.split(':');
			return parts.length === 3 ? parts[2] : decodedCommunityId;
		}
		return decodedCommunityId;
	}, [decodedCommunityId]);

	// Check if community exists and if we're still loading
	const community = simpleCommunityId ? communities.communities.get(simpleCommunityId) : null;
	const isCommunitiesLoading = communities.isLoading;
	const isCommunityFound = !!community;

	// Only fetch from relay if:
	// 1. Community not found in DataManager
	// 2. Communities have finished their initial load (size > 0 means cache loaded)
	// 3. Not currently loading
	const shouldFetchFromRelay = !isCommunityFound && communities.communities.size > 0 && !isCommunitiesLoading && !!decodedCommunityId;

	// If community not found in DataManager after loading is complete, try fetching it from the relay
	const { data: fetchedCommunityEvent, isLoading: isFetchingCommunity } = useQuery({
		queryKey: ["community-fetch", decodedCommunityId],
		queryFn: async (c) => {
			if (!decodedCommunityId) return null;
			const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
			const [kind, pubkey, identifier] = decodedCommunityId.split(":");
			
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
		enabled: shouldFetchFromRelay,
		staleTime: 60000, // Don't refetch for 60 seconds
		gcTime: 300000, // Keep in cache for 5 minutes
	});

	// Memoize fetched community info parsing - only recalculate when event changes
	const fetchedCommunityInfo = useMemo(() => {
		if (!fetchedCommunityEvent) return null;
		return {
			id: fetchedCommunityEvent.tags.find(([name]) => name === "d")?.[1] || "",
			name: fetchedCommunityEvent.tags.find(([name]) => name === "name")?.[1] || "Unnamed Community",
			description: fetchedCommunityEvent.tags.find(([name]) => name === "description")?.[1] || "",
			image: fetchedCommunityEvent.tags.find(([name]) => name === "image")?.[1],
			creator: fetchedCommunityEvent.pubkey,
		};
	}, [fetchedCommunityEvent]);

	const creatorAuthor = useAuthor(fetchedCommunityInfo?.creator || "");
	const creatorMetadata = creatorAuthor.data?.metadata;

	// Get channels from DataManager instead of old useChannels hook
	// getSortedChannels is already memoized via useCallback in DataManagerProvider
	const channels = useMemo(() => {
		return simpleCommunityId ? communities.getSortedChannels(simpleCommunityId) : [];
	}, [simpleCommunityId, communities]);

	// Sync selectedChannel state with URL parameter when URL changes
	// Also handle auto-selection when no channel is specified in URL
	useEffect(() => {
		if (channelId) {
			// URL has a specific channel - use it
			setSelectedChannel(channelId);
		} else if (channels && channels.length > 0) {
			// No channel in URL - auto-select default channel
			const generalChannel = channels.find((channel) =>
				channel.name.toLowerCase() === "general" && channel.type === "text"
			);

			if (generalChannel) {
				setSelectedChannel(generalChannel.id);
			} else {
				const firstTextChannel = channels.find((channel) =>
					channel.type === "text"
				);
				if (firstTextChannel) {
					setSelectedChannel(firstTextChannel.id);
				}
			}
		} else {
			// No channels available
			setSelectedChannel(null);
		}
	}, [channelId, channels]);

	// Check for share query parameter and open share dialog
	useEffect(() => {
		if (searchParams.get('share') === 'true' && community) {
			setShowShareDialog(true);
			// Remove the query parameter from URL
			searchParams.delete('share');
			setSearchParams(searchParams, { replace: true });
		}
	}, [searchParams, setSearchParams, community]);

	// Memoize callback to prevent unnecessary re-renders of child components
	const handleCommunitySectionSelect = useCallback((sectionName: string) => {
		// Navigate to the appropriate community section page
		if (!communityId) return; // Guard against undefined

		if (sectionName === 'marketplace') {
			navigate(`/space/${encodeURIComponent(communityId)}/marketplace`);
		} else if (sectionName === 'resources') {
			navigate(`/space/${encodeURIComponent(communityId)}/resources`);
		}
	}, [communityId, navigate]);

	// Always viewing channels on this page (spaces have separate routes now)
	const isShowingMemberList = showMemberList && selectedChannel;

	// Fail fast - login required
	if (!user) {
		return (
			<BasePageLayout
				mainContent={
					<div className="flex items-center justify-center bg-background h-full">
						<div className="text-center max-w-md p-8 space-y-6">
							<div>
								<h2 className="text-2xl font-bold mb-4">Login Required</h2>
								<p className="text-muted-foreground mb-6">
									Please log in to access communities.
								</p>
							</div>
							<LoginArea className="flex w-full" />
						</div>
					</div>
				}
			/>
		);
	}

	// Fail fast - community ID required
	if (!communityId) {
		return (
			<BasePageLayout
				mainContent={
					<div className="flex items-center justify-center bg-background h-full">
						<div className="text-center max-w-md p-8">
							<h2 className="text-2xl font-bold mb-4">Community Not Found</h2>
							<p className="text-muted-foreground">
								The requested community could not be found.
							</p>
						</div>
					</div>
				}
			/>
		);
	}

	// Show loading state while communities are loading or fetching
	if (isCommunitiesLoading || isFetchingCommunity) {
		return (
			<BasePageLayout
				leftPanel={
					<div className="p-4 space-y-4">
						<Skeleton className="h-8 w-3/4" />
						<div className="space-y-2">
							<Skeleton className="h-6 w-full" />
							<Skeleton className="h-6 w-5/6" />
							<Skeleton className="h-6 w-4/5" />
						</div>
					</div>
				}
				mainContent={
					<div className="flex items-center justify-center bg-background h-full">
						<div className="text-center max-w-md p-8">
							<div className="space-y-4">
								<Skeleton className="h-8 w-48 mx-auto" />
								<Skeleton className="h-4 w-64 mx-auto" />
								<Skeleton className="h-4 w-56 mx-auto" />
							</div>
						</div>
					</div>
				}
			/>
		);
	}

	// Show join interface if community was fetched but user is not a member
	if (!isCommunityFound && fetchedCommunityInfo && !isFetchingCommunity) {
		const handleJoinRequest = async () => {
			if (!decodedCommunityId) return;

			joinCommunity(
				{
					communityId: decodedCommunityId,
					message: joinMessage.trim() || `I would like to join ${fetchedCommunityInfo.name}.`,
				},
				{
					onSuccess: async () => {
						toast({
							title: "Join Request Sent",
							description: "Your request to join the community has been sent to the moderators.",
						});
						// Add the community with pending status to DataManager
						await communities.addProspectiveCommunity(decodedCommunityId);
						// The component will re-render and show the pending state
					},
					onError: (error) => {
						toast({
							title: "Failed to Send Request",
							description: error instanceof Error ? error.message : "An error occurred.",
							variant: "destructive",
						});
					},
				}
			);
		};

		return (
			<BasePageLayout
				mainContent={
					<div className="flex items-center justify-center bg-background h-full p-4">
						<Card className="w-full max-w-2xl">
							<CardHeader>
								<div className="flex items-start gap-4">
									{fetchedCommunityInfo.image && (
										<img
											src={fetchedCommunityInfo.image}
											alt={fetchedCommunityInfo.name}
											className="w-16 h-16 rounded-lg object-cover"
										/>
									)}
									<div className="flex-1">
										<CardTitle className="text-2xl flex items-center gap-2">
											<Users className="h-6 w-6" />
											{fetchedCommunityInfo.name}
										</CardTitle>
										{fetchedCommunityInfo.description && (
											<CardDescription className="mt-2">
												{fetchedCommunityInfo.description}
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
											{(creatorMetadata?.name || genUserName(fetchedCommunityInfo.creator)).substring(0, 2).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<div className="flex-1">
										<p className="text-sm font-medium flex items-center gap-2">
											<Crown className="h-4 w-4 text-yellow-500" />
											{creatorMetadata?.name || genUserName(fetchedCommunityInfo.creator)}
										</p>
										<p className="text-xs text-muted-foreground">Community Owner</p>
									</div>
								</div>

								<div className="p-4 bg-muted/50 rounded-lg">
									<p className="text-sm text-muted-foreground">
										You are not a member of this community. Send a join request to access this space.
									</p>
								</div>

								{/* Join Message */}
								<div className="space-y-2">
									<Label htmlFor="join-message">
										Message to Moderators (Optional)
									</Label>
									<Textarea
										id="join-message"
										placeholder={`I would like to join ${fetchedCommunityInfo.name}...`}
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
				}
			/>
		);
	}

	// Show pending state if user has requested to join but not yet approved
	if (isCommunityFound && community?.membershipStatus === 'pending') {
		return (
			<BasePageLayout
				mainContent={
					<div className="flex items-center justify-center bg-background h-full p-4">
						<Card className="w-full max-w-2xl">
							<CardHeader>
								<div className="flex items-start gap-4">
									{community.info.image && (
										<img
											src={community.info.image}
											alt={community.info.name}
											className="w-16 h-16 rounded-lg object-cover"
										/>
									)}
									<div className="flex-1">
										<CardTitle className="text-2xl flex items-center gap-2">
											<Users className="h-6 w-6" />
											{community.info.name}
										</CardTitle>
										{community.info.description && (
											<CardDescription className="mt-2">
												{community.info.description}
											</CardDescription>
										)}
									</div>
								</div>
							</CardHeader>
							<CardContent className="space-y-6">
								<div className="p-6 bg-muted/50 rounded-lg text-center space-y-3">
									<div className="flex justify-center">
										<div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
											<Users className="h-8 w-8 text-yellow-600 dark:text-yellow-500" />
										</div>
									</div>
									<div>
										<h3 className="text-lg font-semibold mb-2">Awaiting Membership Approval</h3>
										<p className="text-sm text-muted-foreground">
											Your request to join this community is pending review by the moderators. 
											You'll be able to access channels and content once your request is approved.
										</p>
									</div>
								</div>

								<div className="flex gap-3">
									<Button
										variant="outline"
										onClick={() => navigate("/")}
										className="flex-1"
									>
										Back to Communities
									</Button>
								</div>
							</CardContent>
						</Card>
					</div>
				}
			/>
		);
	}

	// Show community not found only after loading is complete and no fetched community
	if (!isCommunityFound && !fetchedCommunityInfo && !isFetchingCommunity) {
		return (
			<BasePageLayout
				mainContent={
					<div className="flex items-center justify-center bg-background h-full">
						<div className="text-center max-w-md p-8">
							<h2 className="text-2xl font-bold mb-4">Community Not Found</h2>
							<p className="text-muted-foreground mb-6">
								The requested community could not be found.
							</p>
							<Button onClick={() => navigate("/")}>Go Home</Button>
						</div>
					</div>
				}
			/>
		);
	}

	// At this point, communityId is guaranteed to exist, so simpleCommunityId is a string
	const finalCommunityId = simpleCommunityId || communityId;

	return (
		<>
			<BasePageLayout
				leftPanel={
					<CommunityPanel
						communityId={finalCommunityId}
						selectedChannel={selectedChannel}
						selectedSpace={null} // No spaces selected on channel page
						onSelectChannel={(channelId) => {
							navigate(`/space/${communityId}/${channelId}`);
						}}
						onSelectSpace={handleCommunitySectionSelect}
					/>
				}
				mainContent={
					// CHANNEL CHAT: Always show chat interface (spaces have separate routes)
					<ChatArea
						communityId={finalCommunityId}
						channelId={selectedChannel}
						onToggleMemberList={() => setShowMemberList(!showMemberList)}
					/>
				}
				rightPanel={
					isShowingMemberList ? (
						<MemberList
							communityId={finalCommunityId}
							channelId={selectedChannel}
						/>
					) : undefined
				}
			/>

			{/* Share Dialog - shown when ?share=true query param is present */}
			{community && (
				<CommunityShareDialog
					community={community}
					open={showShareDialog}
					onOpenChange={setShowShareDialog}
				/>
			)}
		</>
	);
}

export default CommunityPage;
