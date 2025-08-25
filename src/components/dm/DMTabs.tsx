import { Users, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DMTabType } from '@/types/dm';

interface DMTabsProps {
  activeTab: DMTabType;
  onTabChange: (tab: DMTabType) => void;
  idPrefix?: string; // Optional prefix for unique IDs when using multiple instances
  knownCount?: number;
  requestsCount?: number;
}

export function DMTabs({ activeTab, onTabChange, idPrefix = "dm", knownCount, requestsCount }: DMTabsProps) {
  return (
    <div className="flex border-b border-border bg-background">
      {/* Hidden radio inputs for tab control */}
      <input
        type="radio"
        name={`${idPrefix}-tab-control`}
        id={`${idPrefix}-tab-known`}
        checked={activeTab === 'known'}
        onChange={() => onTabChange('known')}
        className="hidden"
      />
      <input
        type="radio"
        name={`${idPrefix}-tab-control`}
        id={`${idPrefix}-tab-new-requests`}
        checked={activeTab === 'newRequests'}
        onChange={() => onTabChange('newRequests')}
        className="hidden"
      />

      {/* Tab list */}
      <div className="flex flex-1">
        {/* Known Tab */}
        <label
          htmlFor={`${idPrefix}-tab-known`}
          className={cn(
            "flex-1 flex items-center justify-center py-2.5 px-1 cursor-pointer transition-all duration-200 border-b-2 min-w-0",
            activeTab === 'known'
              ? "border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="w-4 h-4 mr-1 flex-shrink-0" />
          <span className="text-sm font-medium truncate">Known</span>
          {knownCount !== undefined && knownCount > 0 && (
            <span className="ml-1 px-1 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-full min-w-[1rem] text-center flex-shrink-0 max-w-[2.5rem] overflow-hidden">
              {knownCount}
            </span>
          )}
        </label>

        {/* Requests Tab */}
        <label
          htmlFor={`${idPrefix}-tab-new-requests`}
          className={cn(
            "flex-1 flex items-center justify-center py-2.5 px-1 cursor-pointer transition-all duration-200 border-b-2 min-w-0",
            activeTab === 'newRequests'
              ? "border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <UserPlus className="w-4 h-4 mr-1 flex-shrink-0" />
          <span className="text-sm font-medium truncate">Requests</span>
          {requestsCount !== undefined && requestsCount > 0 && (
            <span className="ml-1 px-1 py-0.5 text-xs font-medium bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-full min-w-[1rem] text-center flex-shrink-0 max-w-[2.5rem] overflow-hidden">
              {requestsCount}
            </span>
          )}
        </label>
      </div>
    </div>
  );
}