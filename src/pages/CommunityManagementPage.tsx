import { CommunityPanel } from "@/components/layout/CommunityPanel";
import { BasePageLayout } from "@/components/layout/BasePageLayout";
import { CommunityManagement } from "@/pages/CommunityManagement";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNavigate, useParams } from "react-router-dom";
import { decodeNaddrFromUrl } from "@/lib/utils";

// Page component for Community Management pages
export function CommunityManagementPage() {
	const { communityId } = useParams<{ communityId: string }>();
	const { user } = useCurrentUser();
	const navigate = useNavigate();

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

	return (
		<BasePageLayout
			leftPanel={
				user && communityId ? (
					<CommunityPanel
						communityId={decodedCommunityId}
						selectedChannel={null}
						selectedSpace={null}
						onSelectChannel={(channelId) => {
							navigate(`/space/${encodeURIComponent(decodedCommunityId)}/${channelId}`);
						}}
						onSelectSpace={(_spaceId) => {
							navigate(`/space/${encodeURIComponent(decodedCommunityId)}`);
						}}
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
								Please log in to access community management.
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
				) : (
					<CommunityManagement />
				)
			}
		/>
	);
}

export default CommunityManagementPage;
