import { useParams } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { DiscordLayout } from "@/components/layout/DiscordLayout";

// Wrapper page that uses DiscordLayout for consistent layout with management content
export function CommunityManagementPage() {
	const { communityId } = useParams<{ communityId: string }>();
	const { user } = useCurrentUser();

	// Show message if not logged in
	if (!user) {
		return <div>Please log in to access community management.</div>;
	}

	if (!communityId) {
		return <div>Community not found.</div>;
	}

	// Use DiscordLayout but in "management mode"
	return (
		<DiscordLayout
			initialDMTargetPubkey={null}
			initialSpaceCommunityId={communityId}
			initialSpaceChannelId={null}
			managementMode={true}
		/>
	);
}

export default CommunityManagementPage;
