import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useUserCommunities } from './useUserCommunities';
import { useDirectMessages } from './useDirectMessages';
import { useEventCache } from './useEventCache';
import { logger } from '@/lib/logger';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';

interface QueryTierState {
  tier1Complete: boolean;
  tier2Complete: boolean;
  tier3Complete: boolean;
  currentTier: number;
  dmPreloaded: boolean;
  userCommunitiesPreloaded: boolean;
  communityMetadataPreloaded: boolean;
  startTime: number;
  tierMetrics: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
}

interface PreloadResult {
  success: boolean;
  duration: number;
  eventCount: number;
  error?: string;
}

/**
 * Optimized query tier system that prioritizes DMs + User Communities first,
 * followed by community metadata, then background content.
 */
export function useOptimizedQueryTiers() {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { cacheEvents } = useEventCache();
  const { user } = useCurrentUser();
  const { data: userCommunities } = useUserCommunities();
  const { data: directMessages } = useDirectMessages();

  const stateRef = useRef<QueryTierState>({
    tier1Complete: false,
    tier2Complete: false,
    tier3Complete: false,
    currentTier: 1,
    dmPreloaded: false,
    userCommunitiesPreloaded: false,
    communityMetadataPreloaded: false,
    startTime: Date.now(),
    tierMetrics: {
      tier1: 0,
      tier2: 0,
      tier3: 0,
    },
  });

  const abortControllerRef = useRef<AbortController>();

  // TIER 1: CRITICAL - DMs + User Communities (Highest Priority)
  const preloadTier1 = useCallback(async (signal: AbortSignal): Promise<PreloadResult> => {
    const tierStart = Date.now();
    
    try {
      logger.log('🚀 TIER 1: Starting critical preload (DMs + User Communities)');

      // Skip if no user
      if (!user?.pubkey) {
        return { success: false, duration: 0, eventCount: 0, error: 'No user' };
      }

      const results: PreloadResult[] = [];

      // 1A: Preload DMs with ultra-aggressive timeout
      if (!stateRef.current.dmPreloaded) {
        try {
          const dmStart = Date.now();
          
          // Ultra-aggressive DM query - both sent and received in one shot
          const dmFilters: NostrFilter[] = [
            {
              kinds: [4, 1059], // NIP-04 and NIP-44 DMs
              '#p': [user.pubkey], // DMs sent to us
              limit: 100, // Reduced limit for speed
            },
            {
              kinds: [4, 1059], // DMs sent by us
              authors: [user.pubkey],
              limit: 100,
            }
          ];

          const dmSignal = AbortSignal.any([signal, AbortSignal.timeout(1000)]); // 1 second timeout
          const dmEvents = await nostr.query(dmFilters, { signal: dmSignal });

          if (dmEvents.length > 0) {
            cacheEvents(dmEvents);
            stateRef.current.dmPreloaded = true;
            results.push({
              success: true,
              duration: Date.now() - dmStart,
              eventCount: dmEvents.length,
            });
            logger.log(`✅ TIER 1A: Preloaded ${dmEvents.length} DM events in ${Date.now() - dmStart}ms`);
          }
        } catch (error) {
          if (!signal.aborted) {
            logger.warn('TIER 1A: DM preload failed:', error);
            results.push({
              success: false,
              duration: Date.now() - tierStart,
              eventCount: 0,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      // 1B: Preload User Communities metadata
      if (!stateRef.current.userCommunitiesPreloaded && userCommunities && userCommunities.length > 0) {
        try {
          const communitiesStart = Date.now();
          
          // Get community IDs prioritized by membership status
          const communityIds = userCommunities
            .sort((a, b) => {
              const statusOrder = { owner: 0, moderator: 1, approved: 2 };
              return statusOrder[a.membershipStatus] - statusOrder[b.membershipStatus];
            })
            .map(community => community.id)
            .slice(0, 5); // Limit to top 5 communities for speed

          if (communityIds.length > 0) {
            // Single query for all community metadata
            const communityFilters: NostrFilter[] = [
              {
                kinds: [34550], // Community metadata
                authors: communityIds.map(id => id.split(':')[1]).filter(Boolean),
                limit: communityIds.length,
              }
            ];

            const communitySignal = AbortSignal.any([signal, AbortSignal.timeout(1500)]); // 1.5 second timeout
            const communityEvents = await nostr.query(communityFilters, { signal: communitySignal });

            if (communityEvents.length > 0) {
              cacheEvents(communityEvents);
              stateRef.current.userCommunitiesPreloaded = true;
              results.push({
                success: true,
                duration: Date.now() - communitiesStart,
                eventCount: communityEvents.length,
              });
              logger.log(`✅ TIER 1B: Preloaded ${communityEvents.length} community metadata events in ${Date.now() - communitiesStart}ms`);
            }
          }
        } catch (error) {
          if (!signal.aborted) {
            logger.warn('TIER 1B: Community metadata preload failed:', error);
            results.push({
              success: false,
              duration: Date.now() - tierStart,
              eventCount: 0,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      const tierDuration = Date.now() - tierStart;
      stateRef.current.tierMetrics.tier1 = tierDuration;
      stateRef.current.tier1Complete = true;

      const totalEvents = results.reduce((sum, result) => sum + result.eventCount, 0);
      const successCount = results.filter(r => r.success).length;

      logger.log(`🎯 TIER 1 COMPLETE: ${successCount}/${results.length} operations successful, ${totalEvents} events in ${tierDuration}ms`);

      return {
        success: successCount > 0,
        duration: tierDuration,
        eventCount: totalEvents,
      };

    } catch (error) {
      if (!signal.aborted) {
        logger.warn('TIER 1: Critical preload failed:', error);
        return {
          success: false,
          duration: Date.now() - tierStart,
          eventCount: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
      return { success: false, duration: 0, eventCount: 0 };
    }
  }, [user, userCommunities, nostr, cacheEvents]);

  // TIER 2: HIGH - Community Channels & Spaces (High Priority)
  const preloadTier2 = useCallback(async (signal: AbortSignal): Promise<PreloadResult> => {
    const tierStart = Date.now();
    
    try {
      logger.log('⚡ TIER 2: Starting high priority preload (Channels & Spaces)');

      if (!user?.pubkey || !userCommunities || userCommunities.length === 0) {
        return { success: false, duration: 0, eventCount: 0, error: 'No user or communities' };
      }

      const results: PreloadResult[] = [];

      // Get top communities (prioritized by membership status)
      const topCommunities = userCommunities
        .sort((a, b) => {
          const statusOrder = { owner: 0, moderator: 1, approved: 2 };
          return statusOrder[a.membershipStatus] - statusOrder[b.membershipStatus];
        })
        .slice(0, 3); // Top 3 communities only

      // 2A: Preload Channels for top communities
      try {
        const channelsStart = Date.now();
        
        const channelFilters: NostrFilter[] = topCommunities.map(community => ({
          kinds: [32807], // Channel definitions
          '#a': [community.id],
          '#t': ['channel'],
          limit: 15, // Reduced limit for speed
        }));

        const channelsSignal = AbortSignal.any([signal, AbortSignal.timeout(2000)]); // 2 second timeout
        const channelEvents = await nostr.query(channelFilters, { signal: channelsSignal });

        if (channelEvents.length > 0) {
          cacheEvents(channelEvents);
          
          // Process and cache channels for each community
          const communitiesProcessed = new Set<string>();
          channelEvents.forEach(event => {
            const communityRef = event.tags.find(([name]) => name === 'a')?.[1];
            if (communityRef && !communitiesProcessed.has(communityRef)) {
              communitiesProcessed.add(communityRef);
              
              // Get channels for this community
              const communityChannels = channelEvents.filter(e => 
                e.tags.find(([name]) => name === 'a')?.[1] === communityRef
              );
              
              // Always include general channel
              const channels = [
                {
                  id: 'general',
                  name: 'general',
                  description: 'General discussion',
                  type: 'text' as const,
                  communityId: communityRef,
                  creator: '',
                  position: 0,
                  event: {} as NostrEvent,
                },
                ...communityChannels
                  .filter(e => {
                    const d = e.tags.find(([name]) => name === 'd')?.[1];
                    const name = e.tags.find(([name]) => name === 'name')?.[1];
                    return d && name && name.toLowerCase() !== 'general';
                  })
                  .map(e => {
                    const d = e.tags.find(([name]) => name === 'd')?.[1] || '';
                    const name = e.tags.find(([name]) => name === 'name')?.[1] || '';
                    
                    let content: { name: string; type: 'text' | 'voice' };
                    try {
                      content = JSON.parse(e.content);
                    } catch {
                      content = { name, type: 'text' };
                    }
                    
                    return {
                      id: d,
                      name: content.name || name,
                      type: content.type || 'text',
                      communityId: communityRef,
                      creator: e.pubkey,
                      event: e,
                    };
                  })
              ];

              // Cache channels
              queryClient.setQueryData(['channels', communityRef], channels, {
                updatedAt: Date.now(),
              });
            }
          });

          results.push({
            success: true,
            duration: Date.now() - channelsStart,
            eventCount: channelEvents.length,
          });
          logger.log(`✅ TIER 2A: Preloaded channels for ${communitiesProcessed.size} communities in ${Date.now() - channelsStart}ms`);
        }
      } catch (error) {
        if (!signal.aborted) {
          logger.warn('TIER 2A: Channel preload failed:', error);
          results.push({
            success: false,
            duration: Date.now() - tierStart,
            eventCount: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // 2B: Preload Spaces for top communities
      try {
        const spacesStart = Date.now();
        
        const spaceFilters: NostrFilter[] = topCommunities.map(community => ({
          kinds: [39097], // Space definitions
          '#a': [community.id],
          '#t': ['space'],
          limit: 10, // Reduced limit for speed
        }));

        const spacesSignal = AbortSignal.any([signal, AbortSignal.timeout(1500)]); // 1.5 second timeout
        const spaceEvents = await nostr.query(spaceFilters, { signal: spacesSignal });

        if (spaceEvents.length > 0) {
          cacheEvents(spaceEvents);
          
          // Process and cache spaces for each community
          topCommunities.forEach(community => {
            const communitySpaces = spaceEvents.filter(e => 
              e.tags.find(([name]) => name === 'a')?.[1] === community.id
            );
            
            // Default spaces
            const defaultSpaces = [
              {
                id: 'marketplace',
                name: 'Marketplace',
                description: 'Buy and sell goods with Bitcoin, Lightning, and Cashu',
                type: 'marketplace' as const,
                icon: 'ShoppingBag',
                enabled: true,
                position: 0,
                communityId: community.id,
                creator: '',
                event: {} as NostrEvent,
              },
              {
                id: 'resources',
                name: 'Resources',
                description: 'Organized collection of useful links and files',
                type: 'resources' as const,
                icon: 'BookOpen',
                enabled: true,
                position: 1,
                communityId: community.id,
                creator: '',
                event: {} as NostrEvent,
              },
            ];

            // Apply custom configurations
            const allSpaces = [...defaultSpaces];
            communitySpaces.forEach(customSpace => {
              const d = customSpace.tags.find(([name]) => name === 'd')?.[1] || '';
              const name = customSpace.tags.find(([name]) => name === 'name')?.[1] || '';
              
              let content: { name?: string; type?: 'marketplace' | 'resources' | 'custom'; icon?: string; enabled?: boolean; position?: number };
              try {
                content = JSON.parse(customSpace.content);
              } catch {
                content = { name };
              }
              
              const existingIndex = allSpaces.findIndex(s => s.id === d);
              if (existingIndex >= 0) {
                allSpaces[existingIndex] = {
                  ...allSpaces[existingIndex],
                  name: content.name || name,
                  icon: content.icon || 'Box',
                  enabled: content.enabled !== false,
                  position: content.position || 999,
                  event: customSpace,
                };
              } else if (content.type === 'custom') {
                allSpaces.push({
                  id: d,
                  name: content.name || name,
                  description: '',
                  type: 'custom' as const,
                  icon: content.icon || 'Box',
                  enabled: content.enabled !== false,
                  position: content.position || 999,
                  communityId: community.id,
                  creator: customSpace.pubkey,
                  event: customSpace,
                });
              }
            });

            const enabledSpaces = allSpaces.filter(space => space.enabled);
            
            // Cache spaces
            queryClient.setQueryData(['spaces', community.id], enabledSpaces, {
              updatedAt: Date.now(),
            });
          });

          results.push({
            success: true,
            duration: Date.now() - spacesStart,
            eventCount: spaceEvents.length,
          });
          logger.log(`✅ TIER 2B: Preloaded spaces for ${topCommunities.length} communities in ${Date.now() - spacesStart}ms`);
        }
      } catch (error) {
        if (!signal.aborted) {
          logger.warn('TIER 2B: Space preload failed:', error);
          results.push({
            success: false,
            duration: Date.now() - tierStart,
            eventCount: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const tierDuration = Date.now() - tierStart;
      stateRef.current.tierMetrics.tier2 = tierDuration;
      stateRef.current.tier2Complete = true;

      const totalEvents = results.reduce((sum, result) => sum + result.eventCount, 0);
      const successCount = results.filter(r => r.success).length;

      logger.log(`⚡ TIER 2 COMPLETE: ${successCount}/${results.length} operations successful, ${totalEvents} events in ${tierDuration}ms`);

      return {
        success: successCount > 0,
        duration: tierDuration,
        eventCount: totalEvents,
      };

    } catch (error) {
      if (!signal.aborted) {
        logger.warn('TIER 2: High priority preload failed:', error);
        return {
          success: false,
          duration: Date.now() - tierStart,
          eventCount: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
      return { success: false, duration: 0, eventCount: 0 };
    }
  }, [user, userCommunities, nostr, cacheEvents, queryClient]);

  // TIER 3: MEDIUM - Recent Messages & Additional Content (Medium Priority)
  const preloadTier3 = useCallback(async (signal: AbortSignal): Promise<PreloadResult> => {
    const tierStart = Date.now();
    
    try {
      logger.log('📊 TIER 3: Starting medium priority preload (Recent Messages)');

      if (!user?.pubkey || !userCommunities || userCommunities.length === 0) {
        return { success: false, duration: 0, eventCount: 0, error: 'No user or communities' };
      }

      const results: PreloadResult[] = [];

      // Get top community for message preloading
      const topCommunity = userCommunities[0];
      if (topCommunity) {
        try {
          const messagesStart = Date.now();
          
          // Preload recent messages for top community's general channel
          const [kind, pubkey, identifier] = topCommunity.id.split(':');
          if (kind && pubkey && identifier) {
            const messageFilters: NostrFilter[] = [
              {
                kinds: [1, 9411], // Both legacy and channel messages
                '#a': [topCommunity.id],
                limit: 25, // Small limit for recent messages only
              }
            ];

            const messagesSignal = AbortSignal.any([signal, AbortSignal.timeout(2500)]); // 2.5 second timeout
            const messageEvents = await nostr.query(messageFilters, { signal: messagesSignal });

            if (messageEvents.length > 0) {
              cacheEvents(messageEvents);
              
              // Filter and validate messages
              const validMessages = messageEvents.filter(event => {
                if (![1, 9411].includes(event.kind)) return false;
                if (event.tags.some(([name]) => name === 'e')) return false; // No replies
                
                if (event.kind === 9411) {
                  const channelTag = event.tags.find(([name]) => name === 't')?.[1];
                  return channelTag === 'general'; // Only general channel for tier 3
                }
                
                // For kind 1, allow if no channel tag or general channel
                const channelTag = event.tags.find(([name]) => name === 't')?.[1];
                return !channelTag || channelTag === 'general';
              });

              if (validMessages.length > 0) {
                // Cache messages for general channel
                queryClient.setQueryData(
                  ['messages', topCommunity.id, 'general'],
                  validMessages.sort((a, b) => a.created_at - b.created_at),
                  {
                    updatedAt: Date.now(),
                  }
                );

                results.push({
                  success: true,
                  duration: Date.now() - messagesStart,
                  eventCount: validMessages.length,
                });
                logger.log(`✅ TIER 3: Preloaded ${validMessages.length} recent messages for ${topCommunity.id} in ${Date.now() - messagesStart}ms`);
              }
            }
          }
        } catch (error) {
          if (!signal.aborted) {
            logger.warn('TIER 3: Message preload failed:', error);
            results.push({
              success: false,
              duration: Date.now() - tierStart,
              eventCount: 0,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      const tierDuration = Date.now() - tierStart;
      stateRef.current.tierMetrics.tier3 = tierDuration;
      stateRef.current.tier3Complete = true;

      const totalEvents = results.reduce((sum, result) => sum + result.eventCount, 0);
      const successCount = results.filter(r => r.success).length;

      logger.log(`📊 TIER 3 COMPLETE: ${successCount}/${results.length} operations successful, ${totalEvents} events in ${tierDuration}ms`);

      return {
        success: successCount > 0,
        duration: tierDuration,
        eventCount: totalEvents,
      };

    } catch (error) {
      if (!signal.aborted) {
        logger.warn('TIER 3: Medium priority preload failed:', error);
        return {
          success: false,
          duration: Date.now() - tierStart,
          eventCount: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
      return { success: false, duration: 0, eventCount: 0 };
    }
  }, [user, userCommunities, nostr, cacheEvents, queryClient]);

  // Main orchestration function
  const executeOptimizedTiers = useCallback(async () => {
    if (!user?.pubkey) return;

    // Cancel any existing tier execution
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    stateRef.current.startTime = Date.now();
    logger.log('🚀 Starting optimized query tier execution');

    try {
      // Execute TIER 1 immediately (Critical: DMs + User Communities)
      const tier1Result = await preloadTier1(signal);
      if (signal.aborted) return;

      // Small delay between tiers to avoid overwhelming the relay
      await new Promise(resolve => setTimeout(resolve, 200));

      // Execute TIER 2 (High: Channels & Spaces)
      const tier2Result = await preloadTier2(signal);
      if (signal.aborted) return;

      // Small delay between tiers
      await new Promise(resolve => setTimeout(resolve, 300));

      // Execute TIER 3 (Medium: Recent Messages)
      const tier3Result = await preloadTier3(signal);
      if (signal.aborted) return;

      const totalTime = Date.now() - stateRef.current.startTime;
      logger.log(`🎉 OPTIMIZED TIERS COMPLETE in ${totalTime}ms:`, {
        tier1: `${tier1Result.duration}ms (${tier1Result.eventCount} events)`,
        tier2: `${tier2Result.duration}ms (${tier2Result.eventCount} events)`,
        tier3: `${tier3Result.duration}ms (${tier3Result.eventCount} events)`,
      });

    } catch (error) {
      if (!signal.aborted) {
        logger.warn('Optimized tier execution failed:', error);
      }
    } finally {
      abortControllerRef.current = undefined;
    }
  }, [user, preloadTier1, preloadTier2, preloadTier3]);

  // Start optimized tiers when user and communities are available
  useEffect(() => {
    if (user?.pubkey && userCommunities && userCommunities.length > 0) {
      // Small delay to ensure initial render is complete
      const timer = setTimeout(() => {
        executeOptimizedTiers();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [user?.pubkey, userCommunities, executeOptimizedTiers]);

  // Cleanup on unmount or user change
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [user?.pubkey]);

  // Public API for status and control
  const getTierStatus = useCallback(() => ({
    currentTier: stateRef.current.currentTier,
    tier1Complete: stateRef.current.tier1Complete,
    tier2Complete: stateRef.current.tier2Complete,
    tier3Complete: stateRef.current.tier3Complete,
    dmPreloaded: stateRef.current.dmPreloaded,
    userCommunitiesPreloaded: stateRef.current.userCommunitiesPreloaded,
    communityMetadataPreloaded: stateRef.current.communityMetadataPreloaded,
    metrics: stateRef.current.tierMetrics,
    totalTime: Date.now() - stateRef.current.startTime,
  }), []);

  const retryTier = useCallback(async (tier: number) => {
    if (!abortControllerRef.current) {
      abortControllerRef.current = new AbortController();
    }

    const signal = abortControllerRef.current.signal;

    switch (tier) {
      case 1:
        return await preloadTier1(signal);
      case 2:
        return await preloadTier2(signal);
      case 3:
        return await preloadTier3(signal);
      default:
        throw new Error(`Invalid tier: ${tier}`);
    }
  }, [preloadTier1, preloadTier2, preloadTier3]);

  return {
    getTierStatus,
    retryTier,
    executeOptimizedTiers,
  };
}

/**
 * Hook to enable optimized query tiers without exposing controls
 */
export function useEnableOptimizedQueryTiers() {
  useOptimizedQueryTiers();
}