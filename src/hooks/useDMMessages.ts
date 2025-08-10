import { useQuery } from "@tanstack/react-query";
import { useAllDMs, validateDMEvent } from "./useAllDMs";
import { useCurrentUser } from "./useCurrentUser";
import type { NostrEvent } from "@/types/nostr";

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

/**
 * Hook to fetch and decrypt messages for a specific conversation
 * Now uses the base useAllDMs hook to avoid query duplication
 */
export function useDMMessages(conversationId: string) {
  const { data: allDMsData } = useAllDMs();
  const { user } = useCurrentUser();

  return useQuery<DecryptedMessage[]>({
    queryKey: ["dm-messages", user?.pubkey, conversationId, allDMsData?.allDMEvents],
    queryFn: async () => {
      if (!user || !conversationId || !allDMsData || !user.signer) return [];

      // Filter messages for this specific conversation from the cached DM events
      const conversationMessages = allDMsData.allDMEvents.filter((event) => {
        if (!validateDMEvent(event)) return false;

        // Additional verification to ensure message is between the two users
        const isFromUser = event.pubkey === user.pubkey;
        const isFromPartner = event.pubkey === conversationId;
        const recipientPTag = event.tags.find(([name]) => name === "p")?.[1] || "";
        const isToUser = recipientPTag === user.pubkey;
        const isToPartner = recipientPTag === conversationId;

        return (isFromUser && isToPartner) || (isFromPartner && isToUser);
      });

      // Deduplicate by event ID (in case same message comes from different relays)
      const uniqueMessages = Array.from(
        new Map(conversationMessages.map((event) => [event.id, event])).values(),
      );

      // Sort by created_at (oldest first for chronological order)
      const sortedMessages = uniqueMessages.sort((a, b) =>
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
    enabled: !!user && !!conversationId && !!allDMsData && !!user.signer,
    refetchInterval: 30 * 1000, // 30 seconds for individual messages
    // IMPORTANT: Clear messages when switching conversations
    placeholderData: undefined,
  });
}
