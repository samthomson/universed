import type { NostrEvent } from '@nostrify/nostrify';

export interface ReactionsAndZapsResult {
  reactions: NostrEvent[];
  zaps: NostrEvent[];
  zapCount: number;
  totalSats: number;
  reactionGroups: Record<string, NostrEvent[]>;
}