import { CommunityPanel } from "@/components/layout/CommunityPanel";
import { BasePageLayout } from "@/components/layout/BasePageLayout";
import { CommunityManagement } from "@/pages/CommunityManagement";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { decodeNaddrFromUrl } from "@/lib/utils";

interface CommunityManagementPageProps {
	communityId: string;
}

// Page component for Community Management pages
export function CommunityManagementPage({ communityId }: CommunityManagementPageProps) {
	const { user } = useCurrentUser();

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

	// Show message if not logged in
	if (!user) {
		return <div>Please log in to access community management.</div>;
	}

	const communityPanel = (
		<CommunityPanel
			communityId={decodedCommunityId}
			selectedChannel={null}
			selectedSpace={null}
			onSelectChannel={() => { }} // No-op in management mode
			onSelectSpace={() => { }} // No-op in management mode
			managementMode={true}
		/>
	);

	return (
		<BasePageLayout leftPanel={communityPanel}>
			<CommunityManagement />
		</BasePageLayout>
	);
}

export default CommunityManagementPage;
