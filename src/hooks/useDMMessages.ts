import { useQuery } from "@tanstack/react-query";
import { useNostr } from "@nostrify/react";
import { useCurrentUser } from "./useCurrentUser";
import type { NostrEvent } from "@nostrify/nostrify";

interface DecryptedMessage {
  id: string;
  pubkey: string;
  created_at: number;
  content: string; // decrypted content
  kind: number;
  tags: NostrEvent["tags"];
  sig: string; // signature from original event
  direction: "sent" | "received";
}

function validateDMEvent(event: NostrEvent): boolean {
  // Accept both NIP-04 (kind 4) and NIP-44 (kind 1059) encrypted DMs
  if (![4, 1059].includes(event.kind)) return false;

  // Must have a 'p' tag for the recipient
  const hasP = event.tags.some(([name]) => name === "p");
  if (!hasP) return false;

  return true;
}

export function useDMMessages(conversationId: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery<DecryptedMessage[]>({
    queryKey: ["dm-messages", user?.pubkey, conversationId],
    queryFn: async (c) => {
      if (!user || !conversationId) return [];
      if (!user.signer) return []; // Need signer for decryption

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Make two separate queries for each direction of the conversation
      const [sentByUser, sentByPartner] = await Promise.all([
        // Messages sent by user to partner
        nostr.query([{
          kinds: [4, 1059], // NIP-04 and NIP-44 encrypted DMs
          authors: [user.pubkey], // Only current user as author
          "#p": [conversationId], // Only conversation partner as recipient
          limit: 100, // Limit per direction
        }], { signal }),

        // Messages sent by partner to user
        nostr.query([{
          kinds: [4, 1059], // NIP-04 and NIP-44 encrypted DMs
          authors: [conversationId], // Only conversation partner as author
          "#p": [user.pubkey], // Only current user as recipient
          limit: 100, // Limit per direction
        }], { signal }),
      ]);

      // Combine results from both queries
      const allMessages = [...sentByUser, ...sentByPartner];

      // Deduplicate by event ID (in case same message comes from different relays)
      const uniqueMessages = Array.from(
        new Map(allMessages.map((event) => [event.id, event])).values(),
      );

      // Validate each message
      const validMessages = uniqueMessages.filter((event) => {
        if (!validateDMEvent(event)) return false;

        // Additional verification to ensure message is between the two users
        const isFromUser = event.pubkey === user.pubkey;
        const isFromPartner = event.pubkey === conversationId;
        const recipientPTag = event.tags.find(([name]) => name === "p")?.[1] ||
          "";
        const isToUser = recipientPTag === user.pubkey;
        const isToPartner = recipientPTag === conversationId;

        return (isFromUser && isToPartner) || (isFromPartner && isToUser);
      });

      // Sort by created_at (oldest first for chronological order)
      const sortedMessages = validMessages.sort((a, b) =>
        a.created_at - b.created_at
      );

      // Decrypt all messages
      const decryptedMessages = await Promise.allSettled(
        sortedMessages.map(async (message) => {
          // Determine the other party's pubkey
          let otherPubkey: string;
          if (message.pubkey === user.pubkey) {
            // We sent this message, find the recipient
            const pTag = message.tags.find(([name]) => name === "p");
            otherPubkey = pTag?.[1] || "";
          } else {
            // We received this message
            otherPubkey = message.pubkey;
          }

          if (!otherPubkey) {
            throw new Error(
              `Could not determine conversation partner for message ${message.id}`,
            );
          }

          let decryptedContent: string;
          try {
            // Try NIP-44 decryption first (if available)
            if (user.signer.nip44 && message.kind === 1059) {
              decryptedContent = await user.signer.nip44.decrypt(
                otherPubkey,
                message.content,
              );
            } // Fall back to NIP-04 decryption
            else if (user.signer.nip04 && message.kind === 4) {
              decryptedContent = await user.signer.nip04.decrypt(
                otherPubkey,
                message.content,
              );
            } else {
              throw new Error(
                `No decryption method available for message ${message.id}`,
              );
            }

            // Return decrypted message with metadata
            return {
              id: message.id,
              pubkey: message.pubkey,
              created_at: message.created_at,
              content: decryptedContent,
              kind: message.kind,
              tags: message.tags,
              sig: message.sig, // Include the signature
              direction: message.pubkey === user.pubkey
                ? "sent"
                : "received" as const,
            };
          } catch (error) {
            console.error(`Failed to decrypt DM ${message.id}:`, error);
            throw error;
          }
        }),
      );

      // Filter out failed decryptions but include successful ones
      return decryptedMessages
        .filter((result): result is PromiseFulfilledResult<DecryptedMessage> =>
          result.status === "fulfilled"
        )
        .map((result) => result.value);
    },
    enabled: !!user && !!conversationId && !!user.signer,
    refetchInterval: 15 * 1000, // 15 seconds - Balanced for DM responsiveness
  });
}
