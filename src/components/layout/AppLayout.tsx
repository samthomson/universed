import { Routes, Route, useParams, useLocation, useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { DMLayout } from "./DMLayout";
import { CommunityPage } from "@/pages/CommunityPage";
import { CommunityListPage } from "@/pages/CommunityListPage";
import { CommunityManagementPage } from "@/pages/CommunityManagementPage";
import { JoinPage } from "@/pages/JoinPage";
import { useState, useEffect } from "react";

// Wrapper components to extract URL parameters
function DMWrapper() {
	const { npub } = useParams<{ npub?: string }>();
	return <DMLayout targetPubkey={npub} />;
}

function CommunityWrapper() {
	const { communityId, channelId } = useParams<{ communityId: string; channelId?: string }>();

	if (!communityId) {
		return <CommunityListPage />;
	}

	return <CommunityPage communityId={communityId} channelId={channelId} />;
}

function ManagementWrapper() {
	const { communityId } = useParams<{ communityId: string }>();

	if (!communityId) {
		return <div>Community not found.</div>;
	}

	return <CommunityManagementPage communityId={communityId} />;
}

// Main component that provides persistent sidebar for all app routes
export function AppLayout() {
	const location = useLocation();
	const navigate = useNavigate();
	const [showCommunitySelectionDialog, setShowCommunitySelectionDialog] = useState(false);
	const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);

	// Sync selectedCommunity with current route
	useEffect(() => {
		const path = location.pathname;
		if (path.startsWith('/space/') && path !== '/space') {
			// Extract community ID from URL
			const segments = path.split('/');
			const communityId = segments[2]; // /space/[communityId]/...
			if (communityId && communityId !== selectedCommunity) {
				setSelectedCommunity(decodeURIComponent(communityId));
			}
		} else if (path.startsWith('/dm') || path === '/space') {
			// DM routes or community list - no community selected
			setSelectedCommunity(null);
		}
	}, [location.pathname, selectedCommunity]);

	// Determine which route pattern we're in
	const path = location.pathname;
	const isDMRoute = path.startsWith('/dm');
	const isSpaceRoute = path.startsWith('/space');
	const isJoinRoute = path.startsWith('/join');

	const handleCommunitySelect = (communityId: string | null) => {
		// Navigate to the appropriate route (selectedCommunity will be synced by useEffect)
		if (communityId) {
			navigate(`/space/${encodeURIComponent(communityId)}`);
		} else {
			// When no community is selected, go back to community list
			navigate('/space');
		}
	};


	return (
		<div className="flex h-screen bg-background text-foreground">
			{/* Persistent AppSidebar - never unmounts */}
			<div className="w-16 bg-background/50 flex flex-col h-full">
				<AppSidebar
					selectedCommunity={selectedCommunity}
					showCommunitySelectionDialog={showCommunitySelectionDialog}
					onShowCommunitySelectionDialogChange={setShowCommunitySelectionDialog}
					onSelectCommunity={handleCommunitySelect}
				/>
			</div>

			{/* Main content area with conditional routing */}
			<div className="flex-1 h-full">
				{isDMRoute && (
					<Routes>
						<Route index element={<DMLayout />} />
						<Route path=":npub" element={<DMWrapper />} />
					</Routes>
				)}

				{isSpaceRoute && (
					<Routes>
						<Route index element={<CommunityListPage />} />
						<Route path=":communityId" element={<CommunityWrapper />} />
						<Route path=":communityId/:channelId" element={<CommunityWrapper />} />
						<Route path=":communityId/manage" element={<ManagementWrapper />} />
					</Routes>
				)}

				{isJoinRoute && (
					<Routes>
						<Route path=":naddr" element={<JoinPage />} />
					</Routes>
				)}
			</div>
		</div>
	);
}

export default AppLayout;
