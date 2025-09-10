import { useCurrentUser } from "@/hooks/useCurrentUser";
import { DiscordLayout } from "@/components/layout/DiscordLayout";
import { naddrToCommunityId } from "@/lib/utils";

interface CommunityPageProps {
	communityId?: string;
	channelId?: string;
}

export function CommunityPage({ communityId, channelId }: CommunityPageProps = {}) {
	const { user } = useCurrentUser();

	// Show message if not logged in - for now, simple message
	if (!user) {
		return <div>Please log in to access communities.</div>;
	}

	// Decode naddr format if needed
	let decodedCommunityId: string | null = null;
	if (communityId) {
		if (communityId.startsWith('naddr1')) {
			try {
				decodedCommunityId = naddrToCommunityId(communityId);
			} catch {
				console.error('Failed to decode naddr');
				decodedCommunityId = communityId;
			}
		} else {
			decodedCommunityId = communityId;
		}
	}

	// Use DiscordLayout but ONLY in community mode
	return (
		<DiscordLayout
			// Don't pass DM params - this is community-only
			initialDMTargetPubkey={null}
			initialSpaceCommunityId={decodedCommunityId}
			initialSpaceChannelId={channelId || null}
		/>
	);
}

export default CommunityPage;
