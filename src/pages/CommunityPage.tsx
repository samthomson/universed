import { useState, useEffect, useMemo } from "react";
import { CommunityPanel } from "@/components/layout/CommunityPanel";
import { ChatArea } from "@/components/layout/ChatArea";
import { MemberList } from "@/components/layout/MemberList";
import { BasePageLayout } from "@/components/layout/BasePageLayout";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNavigate, useParams } from "react-router-dom";
import { decodeNaddrFromUrl, naddrToCommunityId } from "@/lib/utils";
import { useDataManager } from "@/components/DataManagerProvider";
import { Skeleton } from "@/components/ui/skeleton";

// Page component for Community pages
export function CommunityPage() {
	const { communityId, channelId } = useParams<{ communityId: string; channelId?: string }>();
	const { user } = useCurrentUser();
	const navigate = useNavigate();
	const { communities } = useDataManager();

	const [selectedChannel, setSelectedChannel] = useState<string | null>(channelId || null);
	const [showMemberList, setShowMemberList] = useState(true);

	// Decode naddr format to full addressable format (kind:pubkey:identifier)
	let decodedCommunityId = communityId || '';
	if (communityId && communityId.startsWith('naddr1')) {
		try {
			const naddr = decodeNaddrFromUrl(communityId);
			decodedCommunityId = naddrToCommunityId(naddr);
		} catch {
			console.error('Failed to decode naddr');
		}
	}

	// Extract simple community ID from full addressable format for DataManager lookup
	const getSimpleCommunityId = (id: string): string => {
		if (id.includes(':')) {
			// Full addressable format: "34550:pubkey:identifier" -> "identifier"
			const parts = id.split(':');
			return parts.length === 3 ? parts[2] : id;
		}
		return id;
	};

	const simpleCommunityId = decodedCommunityId ? getSimpleCommunityId(decodedCommunityId) : '';

	// Check if community exists and if we're still loading
	const community = simpleCommunityId ? communities.communities.get(simpleCommunityId) : null;
	const isCommunitiesLoading = communities.isLoading;
	const isCommunityFound = !!community;

	// Get channels from DataManager instead of old useChannels hook
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

	const handleCommunitySectionSelect = (sectionName: string) => {
		// Navigate to the appropriate community section page
		if (!communityId) return; // Guard against undefined

		if (sectionName === 'marketplace') {
			navigate(`/space/${encodeURIComponent(communityId)}/marketplace`);
		} else if (sectionName === 'resources') {
			navigate(`/space/${encodeURIComponent(communityId)}/resources`);
		}
	};

	// Always viewing channels on this page (spaces have separate routes now)
	const isShowingMemberList = showMemberList && selectedChannel;

	// Fail fast - login required
	if (!user) {
		return (
			<BasePageLayout
				mainContent={
					<div className="flex items-center justify-center bg-background h-full">
						<div className="text-center max-w-md p-8">
							<h2 className="text-2xl font-bold mb-4">Login Required</h2>
							<p className="text-muted-foreground">
								Please log in to access communities.
							</p>
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

	// Show loading state while communities are loading
	if (isCommunitiesLoading) {
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

	// Show community not found only after loading is complete
	if (!isCommunityFound) {
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

	// At this point, communityId is guaranteed to exist, so simpleCommunityId is a string
	const finalCommunityId = simpleCommunityId || communityId;

	return (
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
	);
}

export default CommunityPage;
