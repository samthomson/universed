import { nip19 } from 'nostr-tools';
import { toast } from '@/hooks/useToast';

/**
 * Generates a community invite link and copies it to clipboard
 * @param communityId The community ID in format "kind:pubkey:identifier"
 * @param communityRelays Array of relay URLs for the community
 */
export async function handleInviteMembers(
  communityId: string,
  communityRelays: string[]
): Promise<void> {
  try {
    // Parse community ID to get the components for naddr
    const [kind, pubkey, identifier] = communityId.split(':');

    // Generate naddr for the community
    const naddr = nip19.naddrEncode({
      kind: parseInt(kind),
      pubkey,
      identifier,
      relays: communityRelays.length > 0 ? communityRelays : undefined,
    });

    // Generate shareable join URL
    const baseUrl = window.location.origin;
    const joinUrl = `${baseUrl}/join/${naddr}`;

    await navigator.clipboard.writeText(joinUrl);
    toast({
      title: "Invite link copied",
      description: "The community invite link has been copied to your clipboard.",
    });
  } catch {
    toast({
      title: "Failed to copy link",
      description: "Could not copy invite link to clipboard.",
      variant: "destructive",
    });
  }
}