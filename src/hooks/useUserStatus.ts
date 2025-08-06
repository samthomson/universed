import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNostr } from "@nostrify/react";
import { useCurrentUser } from "./useCurrentUser";
import { useNostrPublish } from "./useNostrPublish";

export type TraditionalStatus = "online" | "busy" | "away" | "offline";

export interface UserStatus {
  // Traditional status system
  status?: TraditionalStatus;
  // Custom status system
  emoji?: string;
  message?: string;
  // Common fields
  lastSeen?: number;
}

const USER_STATUS_KIND = 30315;

export function useUserStatus(pubkey?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const targetPubkey = pubkey || user?.pubkey;

  return useQuery({
    queryKey: ["user-status", targetPubkey],
    queryFn: async (c) => {
      if (!targetPubkey) return null;

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      const events = await nostr.query([{
        kinds: [USER_STATUS_KIND],
        authors: [targetPubkey],
        "#d": ["status"],
        limit: 1,
      }], { signal });

      if (events.length === 0) {
        return {
          lastSeen: Date.now(),
        };
      }

      const event = events[0];
      const content = event.content || "";
      const statusTag = event.tags.find(([name]) => name === "status")?.[1];

      return {
        status: statusTag as TraditionalStatus,
        emoji: content,
        message: event.tags.find(([name]) => name === "message")?.[1],
        lastSeen: event.created_at * 1000,
      };
    },
    enabled: !!targetPubkey,
    refetchInterval: 60000,
  });
}

export function useUpdateUserStatus() {
  const { mutate: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (status: UserStatus) => {
      const tags = [
        ["d", "status"],
      ];

      if (status.status) {
        tags.push(["status", status.status]);
      }

      if (status.message) {
        tags.push(["message", status.message]);
      }

      createEvent({
        kind: USER_STATUS_KIND,
        content: status.emoji || "",
        tags,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-status"] });
    },
  });
}

export function useClearUserStatus() {
  const { mutate: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      createEvent({
        kind: USER_STATUS_KIND,
        content: "",
        tags: [["d", "status"]],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-status"] });
    },
  });
}

// Helper functions for traditional status
export function getTraditionalStatusColor(status?: TraditionalStatus): string {
  switch (status) {
    case "online":
      return "bg-green-500";
    case "busy":
      return "bg-red-500";
    case "away":
      return "bg-yellow-500";
    case "offline":
    default:
      return "bg-gray-500";
  }
}

export function getTraditionalStatusText(
  status?: string,
): string | undefined {
  if (!status) return;
  switch (status) {
    case "online":
      return "Online";
    case "busy":
      return "Busy";
    case "away":
      return "Away";
    case "offline":
      return "Offline";
    default:
      return "Available";
  }
}
