import { useQuery } from '@tanstack/react-query';
import { useAllDMs, type DMConversation } from './useAllDMs';

/**
 * Legacy hook that returns all DM conversations
 * Now uses the base useAllDMs hook to avoid query duplication
 */
export function useDirectMessages() {
  const { data: allDMsData } = useAllDMs();

  return useQuery<DMConversation[]>({
    queryKey: ['direct-messages', allDMsData?.conversations],
    queryFn: () => {
      return allDMsData?.conversations || [];
    },
    enabled: !!allDMsData,
    // Keep the same refetch interval as the base hook
    refetchInterval: 1000 * 60,
  });
}