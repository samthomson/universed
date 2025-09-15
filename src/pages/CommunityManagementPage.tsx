import { CommunityPanel } from "@/components/layout/CommunityPanel";
import { BasePageLayout } from "@/components/layout/BasePageLayout";
import { CommunityManagement } from "@/pages/CommunityManagement";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNavigate, useParams } from "react-router-dom";
import { decodeNaddrFromUrl, naddrToCommunityId } from "@/lib/utils";

// Page component for Community Management pages
export function CommunityManagementPage() {
	const { communityId } = useParams<{ communityId: string }>();
	const { user } = useCurrentUser();
	const navigate = useNavigate();

	// Fail fast - login required
	if (!user) {
		return (
			<BasePageLayout
				mainContent={
					<div className="flex items-center justify-center bg-background h-full">
						<div className="text-center max-w-md p-8">
							<h2 className="text-2xl font-bold mb-4">Login Required</h2>
							<p className="text-muted-foreground">
								Please log in to access community management.
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

	// Decode naddr format to full addressable format (kind:pubkey:identifier)
	let decodedCommunityId = communityId;
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

	// Normal case - show management interface
	return (
		<BasePageLayout
			leftPanel={
				<CommunityPanel
					communityId={simpleCommunityId}
					selectedChannel={null}
					selectedSpace={null}
					onSelectChannel={(channelId) => {
						navigate(`/space/${encodeURIComponent(decodedCommunityId)}/${channelId}`);
					}}
					onSelectSpace={(_spaceId) => {
						navigate(`/space/${encodeURIComponent(decodedCommunityId)}`);
					}}
				/>
			}
			mainContent={<CommunityManagement />}
		/>
	);
}

export default CommunityManagementPage;

