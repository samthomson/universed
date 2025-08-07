import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';
import type { NostrEvent } from '@nostrify/nostrify';

export type ReportType =
  | 'nudity'
  | 'malware'
  | 'profanity'
  | 'illegal'
  | 'spam'
  | 'impersonation'
  | 'other';

export interface ReportUserParams {
  userPubkey: string;
  reportType: ReportType;
  reason?: string;
  communityId?: string;
}

export interface ReportPostParams {
  postId: string;
  authorPubkey: string;
  reportType: ReportType;
  reason?: string;
  communityId?: string;
}

export interface Report {
  id: string;
  reporterPubkey: string;
  targetPubkey: string;
  targetEventId?: string;
  reportType: ReportType;
  reason: string;
  createdAt: number;
  event: NostrEvent;
}

function validateReportEvent(event: NostrEvent): boolean {
  if (event.kind !== 1984) return false;

  // Must have at least a p tag
  const pTag = event.tags.find(([name]) => name === 'p');
  if (!pTag) return false;

  return true;
}

function parseReportEvent(event: NostrEvent): Report {
  const pTag = event.tags.find(([name]) => name === 'p');
  const eTag = event.tags.find(([name]) => name === 'e');

  const targetPubkey = pTag?.[1] || '';
  const targetEventId = eTag?.[1];
  const reportType = (pTag?.[2] || eTag?.[2] || 'other') as ReportType;

  return {
    id: event.id,
    reporterPubkey: event.pubkey,
    targetPubkey,
    targetEventId,
    reportType,
    reason: event.content,
    createdAt: event.created_at,
    event,
  };
}

/**
 * Hook for reporting users and content (NIP-56)
 */
export function useReporting() {
  const { nostr: _nostr } = useNostr();
  const { mutate: createEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  // Report a user
  const reportUser = useMutation({
    mutationFn: async ({ userPubkey, reportType, reason, communityId }: ReportUserParams) => {
      if (!user) {
        throw new Error('User must be logged in to report content');
      }

      const tags = [
        ['p', userPubkey, reportType],
      ];

      // Add community context if available
      if (communityId) {
        tags.push(['a', communityId]);
      }

      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: 1984, // Report event
            content: reason || '',
            tags,
          },
          {
            onSuccess: () => resolve(),
            onError: (error) => reject(error),
          }
        );
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  // Report a post
  const reportPost = useMutation({
    mutationFn: async ({ postId, authorPubkey, reportType, reason, communityId }: ReportPostParams) => {
      if (!user) {
        throw new Error('User must be logged in to report content');
      }

      const tags = [
        ['e', postId, reportType],
        ['p', authorPubkey],
      ];

      // Add community context if available
      if (communityId) {
        tags.push(['a', communityId]);
      }

      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: 1984,
            content: reason || '',
            tags,
          },
          {
            onSuccess: () => resolve(),
            onError: (error) => reject(error),
          }
        );
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  return {
    reportUser: reportUser.mutate,
    reportPost: reportPost.mutate,
    isReportingUser: reportUser.isPending,
    isReportingPost: reportPost.isPending,
  };
}

/**
 * Hook to fetch reports for moderation review
 */
export function useReports(communityId?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['reports', communityId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);

      // Fetch all report events
      const reportEvents = await nostr.query([
        { kinds: [1984], limit: 200 }
      ], { signal });

      const validReports = reportEvents.filter(validateReportEvent).map(parseReportEvent);

      // If no communityId is specified, return all reports
      if (!communityId) {
        return validReports;
      }

      // Filter reports to only include those with the community a tag
      const communityReports = validReports.filter(report => {
        return report.event.tags.some(
          ([name, value]) => name === 'a' && value === communityId
        );
      });

      return communityReports;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!communityId || communityId === undefined, // Always enabled for flexibility
  });
}

/**
 * Hook to check if current user has reported specific content
 */
export function useHasReported(targetPubkey: string, targetEventId?: string) {
  const { user } = useCurrentUser();
  const { data: reports } = useReports();

  if (!user || !reports) return false;

  return reports.some(report =>
    report.reporterPubkey === user.pubkey &&
    report.targetPubkey === targetPubkey &&
    (!targetEventId || report.targetEventId === targetEventId)
  );
}

/**
 * Hook to get report statistics for a user or post
 */
export function useReportStats(targetPubkey: string, targetEventId?: string) {
  const { data: reports } = useReports();

  if (!reports) {
    return {
      totalReports: 0,
      reportsByType: {} as Record<ReportType, number>,
      reporters: [] as string[],
    };
  }

  const relevantReports = reports.filter(report =>
    report.targetPubkey === targetPubkey &&
    (!targetEventId || report.targetEventId === targetEventId)
  );

  const reportsByType = relevantReports.reduce((acc, report) => {
    acc[report.reportType] = (acc[report.reportType] || 0) + 1;
    return acc;
  }, {} as Record<ReportType, number>);

  const reporters = [...new Set(relevantReports.map(r => r.reporterPubkey))];

  return {
    totalReports: relevantReports.length,
    reportsByType,
    reporters,
  };
}