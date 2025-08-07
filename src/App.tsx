// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHead, UnheadProvider } from '@unhead/react/client';
import { InferSeoMetaPlugin } from '@unhead/addons';
import { Suspense } from 'react';
import NostrProvider from '@/components/NostrProvider';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NostrLoginProvider } from '@nostrify/react/login';
import { AppProvider } from '@/components/AppProvider';
import { AppConfig } from '@/contexts/AppContext';
import { VoiceProvider } from '@/contexts/VoiceContext.tsx';
import { PerformanceIndicator } from '@/components/PerformanceIndicator';
import { useAppContext } from '@/hooks/useAppContext';
import { useEnableSmartPrefetch } from '@/hooks/useSmartPrefetch';
import { useEnablePerformanceMonitoring } from '@/hooks/usePerformanceMonitor';
import { MessageSystemProvider } from '@/contexts/MessageSystemContext';
import { NWCProvider } from '@/contexts/NWCContext';
import { useUserCommunitiesChannelPreloader } from '@/hooks/useUserCommunitiesChannelPreloader';
import { useHighPriorityChannelPreloader } from '@/hooks/useHighPriorityChannelPreloader';
import { useHighPrioritySpacesPreloader } from '@/hooks/useHighPrioritySpacesPreloader';
import { QueryOptimizer } from '@/components/QueryOptimizer';


import AppRouter from './AppRouter';

const head = createHead({
  plugins: [
    InferSeoMetaPlugin(),
  ],
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: true, // Allow refetch on mount but rely on staleTime
      refetchOnReconnect: 'always',
      staleTime: 5 * 60 * 1000, // 5 minutes - Balanced for real-time feel
      gcTime: 30 * 60 * 1000, // 30 minutes - Keep data in memory
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false;
        if (error instanceof Error && error.message.includes('timeout')) return false;
        if (error instanceof Error && error.message.includes('AbortError')) return false;
        return true;
      },
      retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000),
      refetchInterval: false,
      // This is key for cache hits - keep previous data while fetching
      placeholderData: (previousData) => previousData,
      structuralSharing: true,
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});

const defaultConfig: AppConfig = {
  theme: "dark",
  relayUrl: "wss://relay.chorus.community",
  showPerformanceDashboard: true, // Enable by default to show performance improvements
};

const presetRelays = [
  { url: 'wss://relay.chorus.community', name: 'Chorus' },
  { url: 'wss://ditto.pub/relay', name: 'Ditto' },
  { url: 'wss://relay.nostr.band', name: 'Nostr.Band' },
  { url: 'wss://relay.damus.io', name: 'Damus' },
  { url: 'wss://relay.primal.net', name: 'Primal' },
];

function AppContent() {
  const { config, updateConfig } = useAppContext();

  // Enable performance optimizations
  useEnableSmartPrefetch();
  useEnablePerformanceMonitoring();
  useHighPriorityChannelPreloader(); // HIGH PRIORITY: Load channels immediately
  useHighPrioritySpacesPreloader(); // HIGH PRIORITY: Load spaces immediately
  useUserCommunitiesChannelPreloader(); // BACKGROUND: Continue background loading

  const handleHidePerformanceDashboard = () => {
    updateConfig((current) => ({
      ...current,
      showPerformanceDashboard: false,
    }));
  };

  return (
    <MessageSystemProvider>
      <TooltipProvider>
        <QueryOptimizer />
        <Toaster />
        <Sonner />
        <PerformanceIndicator
          isVisible={config.showPerformanceDashboard || false}
          onHide={handleHidePerformanceDashboard}
        />
        <Suspense>
          <AppRouter />
        </Suspense>
      </TooltipProvider>
    </MessageSystemProvider>
  );
}

export function App() {
  return (
    <UnheadProvider head={head}>
      <AppProvider storageKey="nostr:app-config" defaultConfig={defaultConfig} presetRelays={presetRelays}>
        <QueryClientProvider client={queryClient}>
          <NostrLoginProvider storageKey='nostr:login'>
            <NostrProvider>
              <NWCProvider>
                <VoiceProvider>
                  <AppContent />
                </VoiceProvider>
              </NWCProvider>
            </NostrProvider>
          </NostrLoginProvider>
        </QueryClientProvider>
      </AppProvider>
    </UnheadProvider>
  );
}

export default App;
