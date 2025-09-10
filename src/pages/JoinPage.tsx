import { useCurrentUser } from "@/hooks/useCurrentUser";
import { DiscordLayout } from "@/components/layout/DiscordLayout";

// Page specifically for /join/:naddr routes
// This handles community join flows via invite links
export function JoinPage() {
	const { user } = useCurrentUser();

	// Show message if not logged in
	if (!user) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="text-center max-w-md p-8">
					<h2 className="text-2xl font-bold mb-4">Join Community</h2>
					<p className="text-muted-foreground mb-6">
						Please log in to join this community.
					</p>
					{/* TODO: Add proper login component */}
				</div>
			</div>
		);
	}

	// Use DiscordLayout for join flow
	// The useUrlNavigation hook will detect the /join/:naddr route
	// and show the appropriate join dialog
	return (
		<DiscordLayout
			initialDMTargetPubkey={null}
			initialSpaceCommunityId={null}
			initialSpaceChannelId={null}
		/>
	);
}

export default JoinPage;
