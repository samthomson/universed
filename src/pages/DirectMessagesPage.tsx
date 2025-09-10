import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { nip19 } from "nostr-tools";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { DiscordLayout } from "@/components/layout/DiscordLayout";

interface DirectMessagesPageProps {
	targetPubkey?: string;
}

export function DirectMessagesPage({ targetPubkey }: DirectMessagesPageProps = {}) {
	const { user } = useCurrentUser();
	const navigate = useNavigate();

	// Show landing page if not logged in - for now, redirect to home
	if (!user) {
		return <div>Please log in to access direct messages.</div>;
	}

	// Convert npub to hex if needed
	let targetHexPubkey: string | null = null;
	if (targetPubkey) {
		try {
			const decoded = nip19.decode(targetPubkey);
			if (decoded.type === 'npub') {
				targetHexPubkey = decoded.data;
			}
		} catch (error) {
			console.error('Invalid npub format:', error);
			// Fallback: treat as hex pubkey if it's 64 hex characters
			if (targetPubkey.match(/^[a-f0-9]{64}$/i)) {
				targetHexPubkey = targetPubkey;
			}
		}
	}

	// Use DiscordLayout but ONLY in DM mode
	return (
		<DiscordLayout
			initialDMTargetPubkey={targetHexPubkey}
			// Don't pass community params - this is DM-only
			initialSpaceCommunityId={null}
			initialSpaceChannelId={null}
		/>
	);
}

export default DirectMessagesPage;
