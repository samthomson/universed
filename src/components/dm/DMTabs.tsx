import { Users, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DMTabType } from '@/hooks/useDMCategories';

interface DMTabsProps {
  activeTab: DMTabType;
  onTabChange: (tab: DMTabType) => void;
  idPrefix?: string; // Optional prefix for unique IDs when using multiple instances
}

export function DMTabs({ activeTab, onTabChange, idPrefix = "dm" }: DMTabsProps) {
  return (
    <div className="flex border-b border-gray-600 bg-gray-700">
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
            "flex-1 flex items-center justify-center py-3 px-4 cursor-pointer transition-all duration-200 border-b-2",
            activeTab === 'known'
              ? "border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
              : "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          )}
        >
          <Users className="w-4 h-4 mr-2" />
          <span className="text-sm font-medium">Known</span>
        </label>

        {/* Requests Tab */}
        <label
          htmlFor={`${idPrefix}-tab-new-requests`}
          className={cn(
            "flex-1 flex items-center justify-center py-3 px-4 cursor-pointer transition-all duration-200 border-b-2",
            activeTab === 'newRequests'
              ? "border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
              : "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          )}
        >
          <UserPlus className="w-4 h-4 mr-2" />
          <span className="text-sm font-medium">Requests</span>
        </label>
      </div>
    </div>
  );
}