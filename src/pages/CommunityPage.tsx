import { useState, useEffect } from "react";
import { CommunityPanel } from "@/components/layout/CommunityPanel";
import { ChatArea } from "@/components/layout/ChatArea";
import { MemberList } from "@/components/layout/MemberList";
import { BasePageLayout } from "@/components/layout/BasePageLayout";
import { SpacesArea } from "@/components/spaces/SpacesArea";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useChannels } from "@/hooks/useChannels";
import { useNavigate, useParams } from "react-router-dom";
import { decodeNaddrFromUrl } from "@/lib/utils";

// Page component for Community pages
export function CommunityPage() {
	const { communityId, channelId } = useParams<{ communityId: string; channelId?: string }>();
	const { user } = useCurrentUser();
	const navigate = useNavigate();
	const [selectedChannel, setSelectedChannel] = useState<string | null>(channelId || null);
	const [selectedSpace, setSelectedSpace] = useState<string | null>(null);
	const [showMemberList, setShowMemberList] = useState(true);

	// Decode naddr format if needed
	let decodedCommunityId = communityId || '';
	if (communityId && communityId.startsWith('naddr1')) {
		try {
			decodedCommunityId = decodeNaddrFromUrl(communityId);
		} catch {
			console.error('Failed to decode naddr');
			decodedCommunityId = communityId;
		}
	}

	const { data: channels } = useChannels(decodedCommunityId);

	// Auto-select default channel when community loads
	useEffect(() => {
		if (decodedCommunityId && !selectedSpace && channels && channels.length > 0) {
			let newSelectedChannel = selectedChannel;

			if (selectedChannel) {
				const currentChannelExists = channels.some((channel) => channel.id === selectedChannel);
				if (!currentChannelExists) {
					newSelectedChannel = null;
				}
			}

			if (!newSelectedChannel) {
				const generalChannel = channels.find((channel) =>
					channel.name.toLowerCase() === "general" && channel.type === "text"
				);

				if (generalChannel) {
					newSelectedChannel = generalChannel.id;
				} else {
					const firstTextChannel = channels.find((channel) =>
						channel.type === "text"
					);
					if (firstTextChannel) {
						newSelectedChannel = firstTextChannel.id;
					}
				}
			}

			if (newSelectedChannel !== selectedChannel) {
				setSelectedChannel(newSelectedChannel);
			}
		}
	}, [decodedCommunityId, selectedSpace, channels, selectedChannel]);

	const handleChannelSelect = (channelId: string) => {
		setSelectedChannel(channelId);
		setSelectedSpace(null);
	};

	const handleSpaceSelect = (spaceId: string) => {
		setSelectedSpace(spaceId);
		setSelectedChannel(null);
	};

	const handleNavigateToDMs = (targetPubkey?: string) => {
		if (targetPubkey) {
			navigate(`/dm/${targetPubkey}`);
		} else {
			navigate('/dm');
		}
	};

	return (
		<BasePageLayout
			leftPanel={
				user && communityId ? (
					<CommunityPanel
						communityId={decodedCommunityId}
						selectedChannel={selectedChannel}
						selectedSpace={selectedSpace}
						onSelectChannel={handleChannelSelect}
						onSelectSpace={handleSpaceSelect}
						onNavigateToDMs={handleNavigateToDMs}
					/>
				) : (
					<div />
				)
			}
			mainContent={
				!user ? (
					<div className="flex items-center justify-center bg-background h-full">
						<div className="text-center max-w-md p-8">
							<h2 className="text-2xl font-bold mb-4">Login Required</h2>
							<p className="text-muted-foreground">
								Please log in to access communities.
							</p>
						</div>
					</div>
				) : !communityId ? (
					<div className="flex items-center justify-center bg-background h-full">
						<div className="text-center max-w-md p-8">
							<h2 className="text-2xl font-bold mb-4">Community Not Found</h2>
							<p className="text-muted-foreground">
								The requested community could not be found.
							</p>
						</div>
					</div>
				) : selectedSpace ? (
					<SpacesArea
						communityId={decodedCommunityId}
						selectedSpace={selectedSpace}
					/>
				) : (
					<ChatArea
						communityId={decodedCommunityId}
						channelId={selectedChannel}
						onToggleMemberList={() => setShowMemberList(!showMemberList)}
					/>
				)
			}
			rightPanel={
				user && communityId && showMemberList && selectedChannel && !selectedSpace ? (
					<MemberList
						communityId={decodedCommunityId}
						channelId={selectedChannel}
						onNavigateToDMs={handleNavigateToDMs}
					/>
				) : undefined
			}
		/>
	);
}

export default CommunityPage;
