import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { UserPanel } from "@/components/layout/UserPanel";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

// Page that shows just the community list - for /space/ with no specific community
export function CommunityListPage() {
	const { user } = useCurrentUser();
	const navigate = useNavigate();
	const [showCommunitySelectionDialog, setShowCommunitySelectionDialog] = useState(false);

	// Show message if not logged in
	if (!user) {
		return <div>Please log in to access communities.</div>;
	}

	const handleCommunitySelect = (communityId: string | null) => {
		if (communityId) {
			// Navigate to the selected community
			navigate(`/space/${communityId}`);
		} else {
			// Navigate to space picker
			navigate('/space');
		}
	};


	return (
		<div className="flex h-screen bg-background text-foreground">
			{/* Left Sidebar */}
			<div className="w-16 bg-background/50 flex flex-col h-full">
				<AppSidebar
					selectedCommunity={null}
					showCommunitySelectionDialog={showCommunitySelectionDialog}
					onShowCommunitySelectionDialogChange={setShowCommunitySelectionDialog}
					onSelectCommunity={handleCommunitySelect}
				/>
			</div>

			{/* Main Content Area - Just instructions */}
			<div className="flex flex-1 overflow-hidden">
				{/* User Panel - bottom left */}
				<div className="w-72 flex flex-col justify-end">
					<UserPanel />
				</div>

				{/* Right side - instructions or welcome message */}
				<div className="flex-1 flex items-center justify-center bg-background">
					<div className="text-center max-w-md p-8">
						<h2 className="text-2xl font-bold mb-4">Select a Community</h2>
						<p className="text-muted-foreground mb-6">
							Choose a community from the sidebar to start chatting, or click the DM button to send direct messages.
						</p>
						<div className="space-y-2 text-sm text-muted-foreground">
							<p>💬 Communities - Group conversations</p>
							<p>📨 Direct Messages - Private conversations</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default CommunityListPage;
