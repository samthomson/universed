import { useState, useEffect } from "react";
import { CommunityPanel } from "@/components/layout/CommunityPanel";
import { ChatArea } from "@/components/layout/ChatArea";
import { MemberList } from "@/components/layout/MemberList";
import { BasePageLayout } from "@/components/layout/BasePageLayout";
import { SpacesArea } from "@/components/spaces/SpacesArea";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useChannels } from "@/hooks/useChannels";
import { useNavigate } from "react-router-dom";
import { decodeNaddrFromUrl } from "@/lib/utils";

interface CommunityPageProps {
	communityId: string;
	channelId?: string;
}

// Page component for Community pages
export function CommunityPage({ communityId, channelId }: CommunityPageProps) {
	const { user } = useCurrentUser();
	const navigate = useNavigate();
	const [selectedChannel, setSelectedChannel] = useState<string | null>(channelId || null);
	const [selectedSpace, setSelectedSpace] = useState<string | null>(null);
	const [showMemberList, setShowMemberList] = useState(true);
	const [activeTab, setActiveTab] = useState("channels");

	// Decode naddr format if needed
	let decodedCommunityId = communityId;
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
		setActiveTab("channels");
	};

	const handleSpaceSelect = (spaceId: string) => {
		setSelectedSpace(spaceId);
		setSelectedChannel(null);

		if (spaceId === "marketplace") {
			setActiveTab("marketplace");
		} else if (spaceId === "resources") {
			setActiveTab("resources");
		}
	};

	const handleNavigateToDMs = (targetPubkey?: string) => {
		if (targetPubkey) {
			navigate(`/dm/${targetPubkey}`);
		} else {
			navigate('/dm');
		}
	};

	// Show message if not logged in
	if (!user) {
		return <div>Please log in to access communities.</div>;
	}

	const communityPanel = (
		<CommunityPanel
			communityId={decodedCommunityId}
			selectedChannel={selectedChannel}
			selectedSpace={selectedSpace}
			onSelectChannel={handleChannelSelect}
			onSelectSpace={handleSpaceSelect}
			onNavigateToDMs={handleNavigateToDMs}
		/>
	);

	const memberListPanel = showMemberList && selectedChannel && !selectedSpace && activeTab === "channels" ? (
		<MemberList
			communityId={decodedCommunityId}
			channelId={selectedChannel}
			onNavigateToDMs={handleNavigateToDMs}
		/>
	) : undefined;

	const mainContent = (
		<>
			{activeTab === "channels" && (
				<>
					{selectedSpace ? (
						<SpacesArea
							communityId={decodedCommunityId}
							selectedSpace={selectedSpace}
							onNavigateToDMs={handleNavigateToDMs}
						/>
					) : (
						<ChatArea
							communityId={decodedCommunityId}
							channelId={selectedChannel}
							onToggleMemberList={() => setShowMemberList(!showMemberList)}
							onNavigateToDMs={handleNavigateToDMs}
						/>
					)}
				</>
			)}
			{activeTab === "marketplace" && (
				<SpacesArea
					communityId={decodedCommunityId}
					selectedSpace="marketplace"
					onNavigateToDMs={handleNavigateToDMs}
				/>
			)}
			{activeTab === "resources" && (
				<SpacesArea
					communityId={decodedCommunityId}
					selectedSpace="resources"
					onNavigateToDMs={handleNavigateToDMs}
				/>
			)}
		</>
	);

	return (
		<BasePageLayout
			leftPanel={communityPanel}
			rightPanel={memberListPanel}
		>
			{mainContent}
		</BasePageLayout>
	);
}

export default CommunityPage;
